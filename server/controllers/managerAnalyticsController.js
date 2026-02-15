const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const { generateAISuggestions } = require("../services/aiSuggestionsService");

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

    // 2. Fetch related data
    const [employees, feedbacks, metrics] = await Promise.all([
      Employee.find({ managerId }),
      Feedback.find({ managerId }),
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
        ? feedbacks.reduce((sum, f) => sum + f.sentimentScore, 0) / feedbacks.length
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
    const finalScore = computeFinalScore(breakdown, weights);

    // 5. Categorize (suggestions fetched separately via /suggestions endpoint)
    const category = getPerformanceCategory(finalScore);
    const counts = { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length };

    const response = {
      manager,
      breakdown,
      finalScore,
      category,
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
      Feedback.find({ managerId }),
      PerformanceMetric.find({ managerId }),
    ]);

    const avgEmployeeScore =
      employees.length > 0
        ? employees.reduce((sum, e) => sum + normalizeEmployeeScore(e.performanceRating), 0) /
          employees.length
        : 0.5;
    const avgFeedbackScore =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.sentimentScore, 0) / feedbacks.length
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
      feedbacks: feedbacks.map((f) => (f.toObject ? f.toObject() : f)),
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
    const status = msg.includes("OPENAI_API_KEY") ? 503 : 500;
    res.status(status).json({ message: msg });
  }
};
