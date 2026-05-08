const { computeFormulaFlightRisk } = require("./attritionService");

const RATING_KEYS = [
  "communication",
  "recognition",
  "availability",
  "careerGrowth",
  "empowerment",
  "fairness",
  "decisionMaking",
  "conflictResolution",
];

function buildAverageRatings(feedbacks) {
  const ratingFeedbacks = feedbacks.filter((feedback) => feedback.ratings);
  if (ratingFeedbacks.length === 0) return null;

  const avgRatings = {};
  for (const key of RATING_KEYS) {
    const values = ratingFeedbacks
      .map((feedback) => feedback.ratings[key])
      .filter((value) => value != null && value > 0);

    avgRatings[key] = values.length > 0
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null;
  }

  return avgRatings;
}

function buildEmployeeCoachingProfiles({ employees, feedbacks, extendedMetrics }) {
  const ext = extendedMetrics || {};
  const goalCompletionRate = ext.goalCompletionRate ?? 0;
  const totalDevGoals = ext.IDP ?? 0;
  const avgDevGoalAssignment = employees.length > 0
    ? Math.round((totalDevGoals / employees.length) * 100) / 100
    : 0;

  let devGoalStatus = "Behind";
  if (goalCompletionRate >= 75) devGoalStatus = "On Track";
  else if (goalCompletionRate >= 50) devGoalStatus = "At Risk";

  const employeeProfiles = employees.map((employee) => {
    const employeeFeedbacks = feedbacks.filter(
      (feedback) => feedback.fromEmployee === employee.name || feedback.employeeId?.toString() === employee._id?.toString()
    );

    const achievementScore = Math.round(((employee.performanceRating || 3) / 5) * 100);
    const runRate = Math.round((achievementScore / 100) * (goalCompletionRate / 100) * 100);
    const attritionRisk = computeFormulaFlightRisk(employee, employeeFeedbacks, ext);
    const riskLevel = attritionRisk >= 70 ? "High" : attritionRisk >= 40 ? "Medium" : "Low";
    const feedbackSentiment = employeeFeedbacks.length > 0
      ? Math.round((employeeFeedbacks.reduce((sum, feedback) => sum + (feedback.compositeFeedbackScore ?? feedback.sentimentScore ?? 0.5), 0) / employeeFeedbacks.length) * 100) / 100
      : 0.5;
    const sentimentLabel = feedbackSentiment >= 0.6 ? "Positive" : feedbackSentiment <= 0.4 ? "Negative" : "Neutral";
    const pulseMood = employeeFeedbacks.find((feedback) => feedback.pulseMood)?.pulseMood || "neutral";

    return {
      _id: employee._id,
      name: employee.name,
      role: employee.role || "Employee",
      email: employee.email,
      performanceRating: employee.performanceRating || 3,
      achievementScore,
      runRate,
      attritionRisk,
      riskLevel,
      feedbackSentiment,
      sentimentLabel,
      feedbackCount: employeeFeedbacks.length,
      pulseMood,
      avgRatings: buildAverageRatings(employeeFeedbacks),
    };
  });

  return {
    employees: employeeProfiles,
    teamMetrics: {
      goalCompletionRate,
      totalDevGoals,
      avgDevGoalAssignment,
      devGoalStatus,
      teamRetentionRate: ext.teamRetentionRate ?? 0,
      engagementScore: ext.employeeEngagementScore ?? 0,
      promotionRate: ext.employeePromotionRate ?? 0,
      subordinate360Rating: ext.subordinate360Rating ?? 0,
    },
  };
}

module.exports = {
  buildEmployeeCoachingProfiles,
};
