const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { generateAISuggestions, generateEmployeeSuggestions } = require("../services/aiSuggestionsService");
const { computeAIScore } = require("../services/aiScoringService");
const { predictTeamAttrition } = require("../services/attritionService");

// ── Feedback query limits ──
const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;
const FEEDBACK_SCORE_LIMIT = 50;  // max feedbacks used for score computation
const FEEDBACK_AI_LIMIT = 20;     // max feedbacks sent to AI prompts

function getFeedbackDateFilter() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
  return { createdAt: { $gte: cutoff } };
}

/**
 * Normalize employee performanceRating from 1-5 scale to 0-1
 */
function normalizeEmployeeScore(rating) {
  return (rating - 1) / 4;
}

/**
 * Normalize metric value from 0-100 scale to 0-1 (assumes metrics are 0-100)
 */
function normalizeMetricValue(value) {
  return Math.min(1, Math.max(0, value / 100));
}

/**
 * Categorize effectiveness score into performance tier
 */
function getPerformanceCategory(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

/**
 * Compute weighted effectiveness score (0-100)
 */
function computeFinalScore(breakdown, weights) {
  const { avgEmployeeScore, avgFeedbackScore, avgMetricScore } = breakdown;
  const { employee = 0.4, feedback = 0.3, metrics = 0.3 } = weights;
  const raw =
    avgEmployeeScore * employee +
    avgFeedbackScore * feedback +
    avgMetricScore * metrics;
  return Math.round(raw * 100);
}

/**
 * GET /api/manager-analytics/:managerId
 * Fetches all related data, normalizes scores, computes effectiveness,
 * and returns breakdown, category, and suggestions.
 * Query params: employeeWeight, feedbackWeight, metricsWeight (optional)
 */
exports.getManagerAnalytics = async (req, res) => {
  try {
    const { managerId } = req.params;
    const employeeWeight = parseFloat(req.query.employeeWeight) || 0.4;
    const feedbackWeight = parseFloat(req.query.feedbackWeight) || 0.3;
    const metricsWeight = parseFloat(req.query.metricsWeight) || 0.3;

    // 1. Fetch manager
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // 2. Fetch related data (feedbacks limited to rolling window + cap)
    const [employees, feedbacks, metrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
      PerformanceMetric.find({ managerId }),
    ]);

    // 3. Normalize and compute averages (0-1 scale)
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

    // 4. Apply weights and compute final score (0-100)
    const weights = {
      employee: employeeWeight,
      feedback: feedbackWeight,
      metrics: metricsWeight,
    };
    const formulaScore = computeFinalScore(breakdown, weights);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    // ── 5. Fetch/Compute AI Score (24h cache) ──
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

      // Save/Update snapshot
      const existingToday = await ScoreSnapshot.findOne({
        managerId,
        createdAt: { $gte: todayStart },
      });

      if (existingToday) {
        existingToday.aiScore = aiResult.aiScore;
        existingToday.aiBreakdown = aiResult.aiBreakdown;
        existingToday.aiReasoning = aiResult.aiReasoning;
        existingToday.aiStrengths = aiResult.aiStrengths;
        existingToday.aiWeaknesses = aiResult.aiWeaknesses;
        existingToday.finalScore = aiResult.aiScore;
        existingToday.category = getPerformanceCategory(aiResult.aiScore);
        await existingToday.save();
      } else {
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

/**
 * POST /api/manager-analytics/:managerId/suggestions
 * Fetches full Mongo data, sends to AI, returns dynamic suggestions on demand.
 */
exports.generateSuggestions = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
      PerformanceMetric.find({ managerId }),
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

/**
 * POST /api/manager-analytics/:managerId/employee-suggestions
 * Fetches all data, sends to AI to generate per-employee suggestions
 * that would improve the manager's effectiveness score.
 */
exports.generateEmployeeSuggestionsHandler = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, metrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId, ...getFeedbackDateFilter() })
        .sort({ createdAt: -1 })
        .limit(FEEDBACK_SCORE_LIMIT),
      PerformanceMetric.find({ managerId }),
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

/**
 * GET /api/manager-analytics/:managerId/ai-score
 * Returns an AI-computed effectiveness score with 24-hour cache & lock.
 * Uses temperature=0 + structured output for deterministic results.
 */
exports.getAIScore = async (req, res) => {
  try {
    const { managerId } = req.params;

    // 1. Check for cached AI score from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const cachedSnapshot = await ScoreSnapshot.findOne({
      managerId,
      aiScore: { $exists: true, $ne: null },
      createdAt: { $gte: todayStart },
    });

    if (cachedSnapshot) {
      console.log(`📦 AI Score cache hit for manager ${managerId}`);
      return res.json({
        cached: true,
        aiScore: cachedSnapshot.aiScore,
        aiBreakdown: cachedSnapshot.aiBreakdown,
        aiReasoning: cachedSnapshot.aiReasoning,
        aiStrengths: cachedSnapshot.aiStrengths,
        aiWeaknesses: cachedSnapshot.aiWeaknesses,
        formulaScore: cachedSnapshot.finalScore,
        cachedAt: cachedSnapshot.createdAt,
      });
    }

    // 2. No cache — compute fresh AI score
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

    // Compute formula score (same logic as getManagerAnalytics)
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
    const formulaScore = computeFinalScore(breakdown, weights);

    // 3. Call AI scoring service (limit feedbacks sent to AI)
    const aiResult = await computeAIScore({
      manager: manager.toObject ? manager.toObject() : manager,
      employees: employees.map((e) => (e.toObject ? e.toObject() : e)),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map((f) => (f.toObject ? f.toObject() : f)),
      metrics: metrics.map((m) => (m.toObject ? m.toObject() : m)),
      extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
      breakdown,
      formulaScore,
    });

    // 4. Save to today's snapshot (upsert — update if exists, create if not)
    const category = getPerformanceCategory(formulaScore);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    try {
      const existingToday = await ScoreSnapshot.findOne({
        managerId,
        createdAt: { $gte: todayStart },
      });

      if (existingToday) {
        // Update existing snapshot with AI fields
        existingToday.aiScore = aiResult.aiScore;
        existingToday.aiBreakdown = aiResult.aiBreakdown;
        existingToday.aiReasoning = aiResult.aiReasoning;
        existingToday.aiStrengths = aiResult.aiStrengths;
        existingToday.aiWeaknesses = aiResult.aiWeaknesses;
        await existingToday.save();
        console.log(`📸 AI Score saved to existing snapshot for ${manager.name} (${aiResult.aiScore})`);
      } else {
        // Create new snapshot with both formula + AI scores
        await ScoreSnapshot.create({
          managerId,
          finalScore: formulaScore,
          breakdown,
          category,
          counts,
          aiScore: aiResult.aiScore,
          aiBreakdown: aiResult.aiBreakdown,
          aiReasoning: aiResult.aiReasoning,
          aiStrengths: aiResult.aiStrengths,
          aiWeaknesses: aiResult.aiWeaknesses,
        });
        console.log(`📸 New snapshot with AI Score created for ${manager.name} (${aiResult.aiScore})`);
      }
    } catch (snapErr) {
      console.warn("⚠️ Failed to save AI score snapshot:", snapErr.message);
    }

    res.json({
      cached: false,
      aiScore: aiResult.aiScore,
      aiBreakdown: aiResult.aiBreakdown,
      aiReasoning: aiResult.aiReasoning,
      aiStrengths: aiResult.aiStrengths,
      aiWeaknesses: aiResult.aiWeaknesses,
      formulaScore,
    });
  } catch (error) {
    console.error("AI Score error:", error);
    const msg = error.message || "Failed to compute AI score";
    const status =
      msg.includes("OPENROUTER_API_KEY") || msg.includes("API key") ? 503 : 500;
    res.status(status).json({ message: msg });
  }
};

/**
 * POST /api/manager-analytics/:managerId/attrition-risk
 * Predicts attrition and impact for each employee in the team.
 */
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
