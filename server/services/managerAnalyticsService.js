const mongoose = require("mongoose");
const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const EmployeeSuggestionsCache = require("../models/EmployeeSuggestionsCache");
const { computeFormulaScore } = require("../utils/scoring");
const { buildCalibratedAnalytics } = require("./employeeActionablesService");

const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS, 10) || 90;

function toObjectId(id) {
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(id);
}

function toPlainObject(doc) {
  return doc?.toObject ? doc.toObject() : doc;
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

function getFeedbackDateFilter() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
  return { createdAt: { $gte: cutoff } };
}

function buildLatestFeedbackPipeline(managerId) {
  return [
    { $match: { managerId: toObjectId(managerId), ...getFeedbackDateFilter() } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { createdAt: -1 } },
  ];
}

async function fetchManagerScoringInputs(managerId) {
  const managerObjectId = toObjectId(managerId);

  const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
    User.find({ managerId: managerObjectId, userType: "employee" }),
    Feedback.aggregate(buildLatestFeedbackPipeline(managerObjectId)),
    PerformanceMetric.find({ managerId: managerObjectId }),
    ManagerExtendedMetrics.findOne({ managerId: managerObjectId }),
  ]);

  return { employees, feedbacks, metrics, extendedMetrics };
}

function computeManagerScoreFromInputs({ employees, feedbacks, metrics, extendedMetrics }) {
  const avgEmployeeScore = employees.length > 0
    ? employees.reduce((sum, employee) => sum + normalizeEmployeeScore(employee.performanceRating), 0) / employees.length
    : 0.5;
  const avgFeedbackScore = feedbacks.length > 0
    ? feedbacks.reduce((sum, feedback) => sum + (feedback.compositeFeedbackScore ?? feedback.sentimentScore ?? 0.5), 0) / feedbacks.length
    : 0.5;
  const avgMetricScore = metrics.length > 0
    ? metrics.reduce((sum, metric) => sum + normalizeMetricValue(metric.value), 0) / metrics.length
    : 0.5;

  const { finalScore, breakdown: secondaryMetrics } = computeFormulaScore({
    avgEmployeeScore,
    avgFeedbackScore,
    avgMetricScore,
    extendedMetrics,
    employeeCount: employees.length,
  });

  const primaryMetrics = {
    avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
    avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
    avgMetricScore: Math.round(avgMetricScore * 100) / 100,
  };

  return {
    avgEmployeeScore,
    avgFeedbackScore,
    avgMetricScore,
    primaryMetrics,
    secondaryMetrics,
    finalScore,
    category: getPerformanceCategory(finalScore),
    counts: {
      employees: employees.length,
      feedbacks: feedbacks.length,
      metrics: metrics.length,
    },
  };
}

async function computeManagerAnalytics(managerId) {
  const inputs = await fetchManagerScoringInputs(managerId);
  const score = computeManagerScoreFromInputs(inputs);
  const suggestionCache = await EmployeeSuggestionsCache.findOne({ managerId: toObjectId(managerId) })
    .sort({ createdAt: -1 })
    .lean();

  const calibrated = buildCalibratedAnalytics({
    employees: inputs.employees.map(toPlainObject),
    feedbacks: inputs.feedbacks.map(toPlainObject),
    metrics: inputs.metrics.map(toPlainObject),
    extendedMetrics: inputs.extendedMetrics ? toPlainObject(inputs.extendedMetrics) : {},
    employeeSuggestions: suggestionCache?.suggestions || [],
  });

  const breakdown = suggestionCache
    ? calibrated.breakdown
    : {
      ...score.primaryMetrics,
      ...score.secondaryMetrics,
    };

  return {
    ...inputs,
    ...score,
    finalScore: suggestionCache ? calibrated.finalScore : score.finalScore,
    primaryMetrics: suggestionCache ? calibrated.primaryMetrics : score.primaryMetrics,
    secondaryMetrics: suggestionCache ? calibrated.secondaryMetrics : score.secondaryMetrics,
    category: suggestionCache ? calibrated.category : score.category,
    breakdown,
    extendedMetrics: suggestionCache
      ? calibrated.extendedMetrics
      : (inputs.extendedMetrics ? toPlainObject(inputs.extendedMetrics) : {}),
  };
}

async function computeRecentTrend(managerId, monthsBack = 2) {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const snapshots = await ScoreSnapshot.find({
    managerId: toObjectId(managerId),
    createdAt: { $gte: since },
  }).sort({ createdAt: 1 });

  if (snapshots.length < 2) return 0;
  return snapshots[snapshots.length - 1].finalScore - snapshots[0].finalScore;
}

function buildMonthlyTimeline(months) {
  const safeMonths = Math.min(24, Math.max(3, months || 12));
  const now = new Date();
  const timeline = [];

  for (let i = safeMonths - 1; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    timeline.push({
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: monthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    });
  }

  return timeline;
}

function getTierByPercentile(percentile) {
  if (percentile >= 90) return "Champion";
  if (percentile >= 70) return "Elite";
  if (percentile >= 40) return "Contender";
  return "Rising";
}

module.exports = {
  buildLatestFeedbackPipeline,
  buildMonthlyTimeline,
  computeManagerAnalytics,
  computeManagerScoreFromInputs,
  computeRecentTrend,
  fetchManagerScoringInputs,
  getFeedbackDateFilter,
  getPerformanceCategory,
  getTierByPercentile,
  toObjectId,
  toPlainObject,
};
