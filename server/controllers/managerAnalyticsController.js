const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { generateAISuggestions, generateEmployeeSuggestions } = require("../services/aiSuggestionsService");
const { computeAIScore } = require("../services/aiScoringService");
const { predictTeamAttrition } = require("../services/attritionService");

// Feedback query limits
const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;
const FEEDBACK_SCORE_LIMIT = 50;  // max feedbacks used for score computation
const FEEDBACK_AI_LIMIT = 20;     // max feedbacks sent to AI prompts

function getFeedbackDateFilter() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
  return { createdAt: { $gte: cutoff } };
}

// Normalize employee rating (1-5) to 0-1
function normalizeEmployeeScore(rating) {
  return (rating - 1) / 4;
}

// Normalize metric value (0-100) to 0-1
function normalizeMetricValue(value) {
  return Math.min(1, Math.max(0, value / 100));
}

// Get performance category from score
function getPerformanceCategory(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

// Compute weighted effectiveness score (0-100)
function computeFinalScore(breakdown, weights) {
  const { avgEmployeeScore, avgFeedbackScore, avgMetricScore } = breakdown;
  const { employee = 0.4, feedback = 0.3, metrics = 0.3 } = weights;
  const raw =
    avgEmployeeScore * employee +
    avgFeedbackScore * feedback +
    avgMetricScore * metrics;
  return Math.round(raw * 100);
}

// GET /api/manager-analytics/:managerId
exports.getManagerAnalytics = async (req, res) => {
  try {
    const { managerId } = req.params;
    const employeeWeight = parseFloat(req.query.employeeWeight) || 0.4;
    const feedbackWeight = parseFloat(req.query.feedbackWeight) || 0.3;
    const metricsWeight = parseFloat(req.query.metricsWeight) || 0.3;

    // Fetch manager
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Fetch related data (limited to rolling window)
    const [employees, feedbacks, metrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
      PerformanceMetric.find({ managerId }),
    ]);

    // Normalize and compute averages (0-1 scale)
    const avgEmployeeScore =
      employees.length > 0
        ? employees.reduce((sum, e) => sum + normalizeEmployeeScore(e.performanceRating), 0) /
        employees.length
        : 0.5; // default when no data

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

    // Apply weights and compute final score
    const weights = {
      employee: employeeWeight,
      feedback: feedbackWeight,
      metrics: metricsWeight,
    };
    const formulaScore = computeFinalScore(breakdown, weights);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    // Fetch/compute AI score (24h cache)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let aiResult;
    const extendedMetrics = await ManagerExtendedMetrics.findOne({ managerId }) || {};
    const cachedSnapshot = await ScoreSnapshot.findOne({
      managerId,
      aiScore: { $exists: true, $ne: null },
      createdAt: { $gte: todayStart },
    });

    if (cachedSnapshot) {
      aiResult = {
        aiScore: cachedSnapshot.aiScore,
        aiBreakdown: cachedSnapshot.aiBreakdown,
        aiReasoning: cachedSnapshot.aiReasoning,
        aiStrengths: cachedSnapshot.aiStrengths,
        aiWeaknesses: cachedSnapshot.aiWeaknesses,
      };
    } else {
      aiResult = await computeAIScore({
        manager: manager.toObject ? manager.toObject() : manager,
        employees: employees.map((e) => (e.toObject ? e.toObject() : e)),
        feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map((f) => (f.toObject ? f.toObject() : f)),
        metrics: metrics.map((m) => (m.toObject ? m.toObject() : m)),
        extendedMetrics,
        breakdown,
        formulaScore,
      });

      // Save snapshot
      const category = getPerformanceCategory(aiResult.aiScore);
      await ScoreSnapshot.create({
        managerId,
        finalScore: aiResult.aiScore,
        breakdown,
        category,
        counts,
        aiScore: aiResult.aiScore,
        aiBreakdown: aiResult.aiBreakdown,
        aiReasoning: aiResult.aiReasoning,
        aiStrengths: aiResult.aiStrengths,
        aiWeaknesses: aiResult.aiWeaknesses,
      });
    }

    const response = {
      manager: {
        ...manager.toObject ? manager.toObject() : manager,
        effectivenessScore: aiResult.aiScore,
      },
      breakdown: {
        ...breakdown,
        ...(aiResult.aiBreakdown || {}),
        avgFeedbackScore: aiResult.aiBreakdown?.feedbackSentiment !== undefined
          ? aiResult.aiBreakdown.feedbackSentiment / 100
          : breakdown.avgFeedbackScore
      },
      extendedMetrics: extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics,
      finalScore: aiResult.aiScore,
      aiScore: aiResult.aiScore,
      aiReasoning: aiResult.aiReasoning,
      aiStrengths: aiResult.aiStrengths,
      aiWeaknesses: aiResult.aiWeaknesses,
      category: getPerformanceCategory(aiResult.aiScore),
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

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
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

    const weights = { employee: 0.4, feedback: 0.3, metrics: 0.3 };
    const finalScore = computeFinalScore(breakdown, weights);
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

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
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

    const weights = { employee: 0.4, feedback: 0.3, metrics: 0.3 };
    const finalScore = computeFinalScore(breakdown, weights);
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

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
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
