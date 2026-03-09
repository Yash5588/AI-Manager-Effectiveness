const mongoose = require("mongoose");
const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { computeExtendedScore, computeFinalScore } = require("../utils/scoring");
const { getPerformanceCategory } = require("../services/reportService");

const { predictTeamAttrition } = require("../services/attritionService");

const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;
const FEEDBACK_SCORE_LIMIT = 50;
const FEEDBACK_AI_LIMIT = 20;

function getFeedbackDateFilter() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
  return { createdAt: { $gte: cutoff } };
}

function normalizeEmployeeScore(rating) {
  return (rating - 1) / 4;
}

function normalizeMetricValue(value) {
  return Math.min(1, Math.max(0, value / 100));
}

function getPerformanceCategory(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

// Removed local computeExtendedScore and computeFinalScore logic as it is now in utils/scoring.js

exports.getManagerAnalytics = async (req, res) => {
  try {
    const { managerId } = req.params;
    const employeeWeight = parseFloat(req.query.employeeWeight) || 0.2;
    const feedbackWeight = parseFloat(req.query.feedbackWeight) || 0.2;
    const metricsWeight = parseFloat(req.query.metricsWeight) || 0.2;
    const extendedWeight = parseFloat(req.query.extendedWeight) || 0.4;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, latestFeedbacks, metrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }),
      Feedback.aggregate([
        { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
      ]),
      PerformanceMetric.find({ managerId }),
    ]);

    const feedbacks = latestFeedbacks;

    const avgEmployeeScore =
      employees.length > 0
        ? employees.reduce((sum, e) => sum + normalizeEmployeeScore(e.performanceRating), 0) /
        employees.length
        : 0.5;

    const avgFeedbackScore =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
        : 0.5;

    const avgMetricScore =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + normalizeMetricValue(m.value), 0) /
        metrics.length
        : 0.5;

    const breakdown = {
      avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
      avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
      avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    const extendedMetrics = await ManagerExtendedMetrics.findOne({ managerId }) || {};
    const avgExtendedScore = computeExtendedScore(extendedMetrics, employees.length);

    const weights = {
      employee: employeeWeight,
      feedback: feedbackWeight,
      metrics: metricsWeight,
      extended: extendedWeight,
    };
    const formulaScore = computeFinalScore(breakdown, weights, avgExtendedScore);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    // extendedMetrics already loaded above
    const latestSnapshot = await ScoreSnapshot.findOne({
      managerId,
      aiScore: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    let finalScore, aiResult;
    if (latestSnapshot) {
      finalScore = latestSnapshot.aiScore;
      aiResult = {
        aiBreakdown: latestSnapshot.aiBreakdown,
        aiReasoning: latestSnapshot.aiReasoning,
        aiStrengths: latestSnapshot.aiStrengths,
        aiWeaknesses: latestSnapshot.aiWeaknesses,
      };
    } else {
      finalScore = formulaScore;
      aiResult = {};
    }

    const response = {
      manager: {
        ...manager.toObject ? manager.toObject() : manager,
        effectivenessScore: finalScore,
      },
      breakdown: {
        ...breakdown,
        ...(aiResult.aiBreakdown || {}),
        avgFeedbackScore: aiResult.aiBreakdown?.feedbackSentiment !== undefined
          ? aiResult.aiBreakdown.feedbackSentiment / 100
          : breakdown.avgFeedbackScore
      },
      extendedMetrics: extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics,
      finalScore,
      aiScore: finalScore,
      aiReasoning: aiResult.aiReasoning || null,
      aiStrengths: aiResult.aiStrengths || [],
      aiWeaknesses: aiResult.aiWeaknesses || [],
      category: getPerformanceCategory(finalScore),
      weights,
      counts,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/manager-analytics/:managerId/suggestions
exports.generateSuggestions = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }),
      Feedback.aggregate([
        { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
      ]),
      PerformanceMetric.find({ managerId }),
      ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const avgEmployeeScore =
      employees.length > 0
        ? employees.reduce((sum, e) => sum + normalizeEmployeeScore(e.performanceRating), 0) /
        employees.length
        : 0.5;
    const avgFeedbackScore =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
        : 0.5;
    const avgMetricScore =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + normalizeMetricValue(m.value), 0) / metrics.length
        : 0.5;

    const breakdown = {
      avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
      avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
      avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    const avgExtendedScore = computeExtendedScore(extendedMetrics, employees.length);
    const weights = { employee: 0.2, feedback: 0.2, metrics: 0.2, extended: 0.4 };
    const finalScore = computeFinalScore(breakdown, weights, avgExtendedScore);
    const category = getPerformanceCategory(finalScore);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    const payload = {
      manager: manager.toObject ? manager.toObject() : manager,
      employees: employees.map((e) => (e.toObject ? e.toObject() : e)),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map((f) => (f.toObject ? f.toObject() : f)),
      metrics: metrics.map((m) => (m.toObject ? m.toObject() : m)),
      extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
      breakdown,
      finalScore,
      category,
      counts,
    };

    const suggestions = await generateAISuggestions(payload);
    res.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    const msg = error.message || "Failed to generate suggestions";
    const status =
      msg.includes("OPENROUTER_API_KEY") || msg.includes("API key") ? 503 : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/manager-analytics/:managerId/employee-suggestions
exports.generateEmployeeSuggestionsHandler = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }),
      Feedback.aggregate([
        { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
      ]),
      PerformanceMetric.find({ managerId }),
      ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const avgEmployeeScore =
      employees.length > 0
        ? employees.reduce((sum, e) => sum + normalizeEmployeeScore(e.performanceRating), 0) /
        employees.length
        : 0.5;
    const avgFeedbackScore =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
        : 0.5;
    const avgMetricScore =
      metrics.length > 0
        ? metrics.reduce((sum, m) => sum + normalizeMetricValue(m.value), 0) / metrics.length
        : 0.5;

    const breakdown = {
      avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
      avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
      avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    const avgExtendedScore = computeExtendedScore(extendedMetrics, employees.length);
    const weights = { employee: 0.2, feedback: 0.2, metrics: 0.2, extended: 0.4 };
    const finalScore = computeFinalScore(breakdown, weights, avgExtendedScore);
    const category = getPerformanceCategory(finalScore);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    const payload = {
      manager: manager.toObject ? manager.toObject() : manager,
      employees: employees.map((e) => (e.toObject ? e.toObject() : e)),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map((f) => (f.toObject ? f.toObject() : f)),
      metrics: metrics.map((m) => (m.toObject ? m.toObject() : m)),
      extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
      breakdown,
      finalScore,
      category,
      counts,
    };

    const employeeSuggestions = await generateEmployeeSuggestions(payload);
    res.json({ employeeSuggestions, currentScore: finalScore });
  } catch (error) {
    console.error("Employee suggestions error:", error);
    const msg = error.message || "Failed to generate employee suggestions";
    const status =
      msg.includes("OPENROUTER_API_KEY") || msg.includes("API key") ? 503 : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/manager-analytics/:managerId/attrition-risk
exports.getAttritionPredictions = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }),
      Feedback.aggregate([
        { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { createdAt: -1 } },
      ]),
      PerformanceMetric.find({ managerId }),
      ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const payload = {
      manager: manager.toObject ? manager.toObject() : manager,
      employees: employees.map((e) => (e.toObject ? e.toObject() : e)),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map((f) => (f.toObject ? f.toObject() : f)),
      metrics: metrics.map((m) => (m.toObject ? m.toObject() : m)),
      extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
    };

    const predictions = await predictTeamAttrition(payload);
    res.json({ predictions });
  } catch (error) {
    console.error("Attrition prediction error:", error);
    const msg = error.message || "Failed to predict attrition";
    const status =
      msg.includes("OPENROUTER_API_KEY") || msg.includes("API key") ? 503 : 500;
    res.status(status).json({ message: msg });
  }
};
