const { buildEmployeeCoachingProfiles } = require("./employeeCoachingService");
const {
  computeFormulaFlightRisk,
  computeFormulaImpactScore,
  getLevel,
} = require("./attritionService");
const { computeFormulaScore } = require("../utils/scoring");

const DEFAULT_IMPACTS = {
  performance: {
    performanceRatingDelta: 0.12,
    achievementScoreDelta: 4,
    runRateDelta: 3,
    managerScoreDelta: 0.8,
    goalCompletionRateDelta: 1.5,
  },
  communication: {
    feedbackSentimentDelta: 0.15,
    attritionRiskDelta: -4,
    subordinate360RatingDelta: 1.5,
    engagementScoreDelta: 1.5,
    managerScoreDelta: 0.6,
  },
  collaboration: {
    feedbackSentimentDelta: 0.12,
    attritionRiskDelta: -3,
    teamRetentionRateDelta: 0.8,
    engagementScoreDelta: 1.2,
    managerScoreDelta: 0.5,
  },
  skills: {
    performanceRatingDelta: 0.1,
    achievementScoreDelta: 3,
    runRateDelta: 2,
    goalCompletionRateDelta: 1,
    idpDelta: 0.2,
    managerScoreDelta: 0.7,
  },
  initiative: {
    performanceRatingDelta: 0.08,
    achievementScoreDelta: 2.5,
    runRateDelta: 4,
    goalCompletionRateDelta: 1.8,
    managerScoreDelta: 0.7,
  },
  wellbeing: {
    feedbackSentimentDelta: 0.18,
    attritionRiskDelta: -7,
    teamRetentionRateDelta: 1.5,
    engagementScoreDelta: 3,
    managerScoreDelta: 0.8,
  },
};

const KPI_IMPACT_KEYS = new Set([
  "goalCompletionRateDelta",
  "engagementScoreDelta",
  "teamRetentionRateDelta",
  "subordinate360RatingDelta",
  "idpDelta",
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function sanitizeKpiImpact(impact = {}) {
  const sanitized = {};
  Object.entries(impact || {}).forEach(([key, value]) => {
    if (!KPI_IMPACT_KEYS.has(key)) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue === 0) return;
    sanitized[key] = round(numericValue, 3);
  });
  return sanitized;
}

function getPerformanceCategory(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

function getDevGoalStatus(goalCompletionRate) {
  if (goalCompletionRate >= 75) return "On Track";
  if (goalCompletionRate >= 50) return "At Risk";
  return "Behind";
}

function buildActionableImpact(focus, employeeProfile, scale = 1) {
  const baseImpact = DEFAULT_IMPACTS[focus] || DEFAULT_IMPACTS.performance;
  const performanceModifier = employeeProfile && employeeProfile.performanceRating >= 4 ? 0.9 : 1;
  const riskModifier = employeeProfile && employeeProfile.attritionRisk >= 60 ? 1.15 : 1;
  const mergedImpact = {};

  for (const [key, value] of Object.entries(baseImpact)) {
    let modifier = performanceModifier;
    if (key === "attritionRiskDelta" || key === "engagementScoreDelta" || key === "teamRetentionRateDelta") {
      modifier = riskModifier;
    }
    mergedImpact[key] = round(value * modifier * scale, 3);
  }

  return mergedImpact;
}

function buildDefaultActionables(employeeName, suggestion, employeeProfile, suggestionIndex, employeeIndex = 0) {
  const focus = suggestion.focus || "performance";
  const baseId = slugify(`${employeeName}-${employeeIndex}-${suggestionIndex}`);

  return [
    {
      id: `${baseId}-act-0`,
      title: suggestion.title,
      description: suggestion.description || `Work with ${employeeName} on this coaching touchpoint and capture a measurable checkpoint.`,
      completed: false,
      completedAt: null,
      impact: buildActionableImpact(focus, employeeProfile, 1.0),
    }
  ];
}

function ensureActionableShape(actionable, fallbackId, focus, employeeProfile) {
  const existingId = actionable?.id || actionable?._id?.toString();
  return {
    ...actionable,
    id: existingId || fallbackId,
    title: actionable?.title || "Complete coaching step",
    description: actionable?.description || "Finish this development step and log the outcome.",
    completed: actionable?.completed === true,
    completedAt: actionable?.completedAt || null,
    impact: (actionable?.impact && typeof actionable.impact === "object" && Object.keys(actionable.impact).length > 0)
      ? actionable.impact
      : buildActionableImpact(focus, employeeProfile, 0.5),
  };
}

function ensureEmployeeSuggestionsActionables(employeeSuggestions = [], coachingProfiles = []) {
  const profileMap = new Map(
    coachingProfiles.map((profile) => [profile.name, profile])
  );

  let changed = false;
  const suggestions = employeeSuggestions.map((employeeSuggestion, employeeIndex) => {
    const employeeProfile = profileMap.get(employeeSuggestion.employeeName);
    const normalizedSuggestions = (employeeSuggestion.suggestions || []).map((suggestion, suggestionIndex) => {
      const focus = suggestion.focus || "performance";

      // If we have actionables, take only the first one to comply with the new 1-per-suggestion rule
      let actionables = Array.isArray(suggestion.actionables) && suggestion.actionables.length > 0
        ? suggestion.actionables.slice(0, 1)
        : buildDefaultActionables(employeeSuggestion.employeeName, suggestion, employeeProfile, suggestionIndex, employeeIndex);

      if (!Array.isArray(suggestion.actionables) || suggestion.actionables.length === 0 || suggestion.actionables.length > 1) {
        changed = true;
      }

      return {
        ...suggestion,
        actionables: actionables.map((actionable, actionableIndex) =>
          ensureActionableShape(
            actionable,
            `${slugify(`${employeeSuggestion.employeeName}-${employeeIndex}-${suggestionIndex}`)}-act-${actionableIndex}`,
            focus,
            employeeProfile
          )
        ),
      };
    });

    return {
      ...employeeSuggestion,
      suggestions: normalizedSuggestions,
    };
  });

  return { suggestions, changed };
}

function buildCompletedImpactMap(employeeSuggestions = []) {
  const map = new Map();

  employeeSuggestions.forEach((employeeSuggestion) => {
    const aggregate = {};

    (employeeSuggestion.suggestions || []).forEach((suggestion) => {
      (suggestion.actionables || []).forEach((actionable) => {
        if (!actionable?.completed) return;
        if (actionable?.impactAppliedToDb) return;
        Object.entries(sanitizeKpiImpact(actionable.impact || {})).forEach(([key, value]) => {
          aggregate[key] = round((aggregate[key] || 0) + (Number(value) || 0), 3);
        });
      });
    });

    map.set(employeeSuggestion.employeeName, aggregate);
  });

  return map;
}

function buildAggregateImpactTotals(impactMap = new Map()) {
  const totals = {};

  impactMap.forEach((impact) => {
    Object.entries(impact || {}).forEach(([key, value]) => {
      totals[key] = round((totals[key] || 0) + (Number(value) || 0), 3);
    });
  });

  return totals;
}

function getActionableProgress(employeeSuggestions = []) {
  let completed = 0;
  let total = 0;

  employeeSuggestions.forEach((employeeSuggestion) => {
    (employeeSuggestion.suggestions || []).forEach((suggestion) => {
      (suggestion.actionables || []).forEach((actionable) => {
        total += 1;
        if (actionable?.completed) completed += 1;
      });
    });
  });

  return {
    completed,
    total,
    completionRate: total > 0 ? round((completed / total) * 100, 1) : 0,
  };
}

function applyImpactToCoachingProfiles(coachingProfiles = [], impactMap = new Map()) {
  return coachingProfiles.map((profile) => {
    const impact = impactMap.get(profile.name) || {};
    const attritionRisk = clamp(
      round(
        profile.attritionRisk +
        (impact.attritionRiskDelta || 0) -
        (impact.feedbackSentimentDelta || 0) * 20 -
        (impact.performanceRatingDelta || 0) * 6
      ),
      0,
      100
    );

    return {
      ...profile,
      performanceRating: clamp(round(profile.performanceRating + (impact.performanceRatingDelta || 0), 2), 1, 5),
      achievementScore: clamp(round(profile.achievementScore + (impact.achievementScoreDelta || 0), 1), 0, 100),
      runRate: clamp(round(profile.runRate + (impact.runRateDelta || 0), 1), 0, 100),
      feedbackSentiment: clamp(round(profile.feedbackSentiment + (impact.feedbackSentimentDelta || 0), 3), 0, 1),
      attritionRisk,
      riskLevel: getLevel(attritionRisk),
    };
  });
}

function buildCalibratedTeamMetrics(teamMetrics = {}, impactMap = new Map(), employeeCount = 0) {
  const totals = {
    teamRetentionRateDelta: 0,
    goalCompletionRateDelta: 0,
    engagementScoreDelta: 0,
    subordinate360RatingDelta: 0,
    idpDelta: 0,
    performanceRatingDelta: 0,
  };

  impactMap.forEach((impact) => {
    Object.keys(totals).forEach((key) => {
      totals[key] += Number(impact[key] || 0);
    });
  });

  const totalDevGoals = Math.max(
    0,
    round((teamMetrics.totalDevGoals || 0) + totals.idpDelta)
  );
  const goalCompletionRate = clamp(
    round((teamMetrics.goalCompletionRate || 0) + totals.goalCompletionRateDelta),
    0,
    100
  );

  return {
    goalCompletionRate,
    totalDevGoals,
    avgDevGoalAssignment: employeeCount > 0 ? round(totalDevGoals / employeeCount) : 0,
    devGoalStatus: getDevGoalStatus(goalCompletionRate),
    teamRetentionRate: clamp(round((teamMetrics.teamRetentionRate || 0) + totals.teamRetentionRateDelta), 0, 100),
    engagementScore: clamp(round((teamMetrics.engagementScore || 0) + totals.engagementScoreDelta), 0, 100),
    promotionRate: clamp(round((teamMetrics.promotionRate || 0) + totals.performanceRatingDelta * 2), 0, 100),
    subordinate360Rating: clamp(round((teamMetrics.subordinate360Rating || 0) + totals.subordinate360RatingDelta), 0, 100),
  };
}

function buildCalibratedAnalytics({
  employees = [],
  feedbacks = [],
  metrics = [],
  extendedMetrics = {},
  employeeSuggestions = [],
}) {
  const coachingData = buildEmployeeCoachingProfiles({ employees, feedbacks, extendedMetrics });
  const ensured = ensureEmployeeSuggestionsActionables(employeeSuggestions, coachingData.employees);
  const impactMap = buildCompletedImpactMap(ensured.suggestions);
  const aggregateImpactTotals = buildAggregateImpactTotals(impactMap);
  const calibratedCoachingProfiles = applyImpactToCoachingProfiles(coachingData.employees, impactMap);
  const calibratedTeamMetrics = buildCalibratedTeamMetrics(
    coachingData.teamMetrics,
    impactMap,
    calibratedCoachingProfiles.length
  );
  const rawAvgFeedbackScore = feedbacks.length > 0
    ? feedbacks.reduce((sum, feedback) => sum + (feedback.compositeFeedbackScore ?? feedback.sentimentScore ?? 0.5), 0) / feedbacks.length
    : 0.5;
  const avgFeedbackDelta = coachingData.employees.length > 0
    ? calibratedCoachingProfiles.reduce((sum, employee, index) => {
      const baseProfile = coachingData.employees[index];
      return sum + (employee.feedbackSentiment - (baseProfile?.feedbackSentiment || 0));
    }, 0) / coachingData.employees.length
    : 0;

  const avgEmployeeScore = calibratedCoachingProfiles.length > 0
    ? calibratedCoachingProfiles.reduce((sum, employee) => sum + ((employee.performanceRating - 1) / 4), 0) / calibratedCoachingProfiles.length
    : 0.5;
  const avgFeedbackScore = clamp(round(rawAvgFeedbackScore + avgFeedbackDelta, 4), 0, 1);
  const avgMetricScore = metrics.length > 0
    ? metrics.reduce((sum, metric) => sum + Math.min(1, Math.max(0, (metric.value || 0) / 100)), 0) / metrics.length
    : 0.5;

  const calibratedExtendedMetrics = {
    ...extendedMetrics,
    teamRetentionRate: calibratedTeamMetrics.teamRetentionRate,
    goalCompletionRate: calibratedTeamMetrics.goalCompletionRate,
    employeePromotionRate: calibratedTeamMetrics.promotionRate,
    subordinate360Rating: calibratedTeamMetrics.subordinate360Rating,
    employeeEngagementScore: calibratedTeamMetrics.engagementScore,
    IDP: calibratedTeamMetrics.totalDevGoals,
  };

  const { finalScore: formulaScore, breakdown: secondaryMetrics } = computeFormulaScore({
    avgEmployeeScore,
    avgFeedbackScore,
    avgMetricScore,
    extendedMetrics: calibratedExtendedMetrics,
    employeeCount: calibratedCoachingProfiles.length,
  });
  const managerScoreDelta = round(aggregateImpactTotals.managerScoreDelta || 0, 2);
  const finalScore = clamp(round(formulaScore + managerScoreDelta, 1), 0, 100);

  const primaryMetrics = {
    avgEmployeeScore: round(avgEmployeeScore),
    avgFeedbackScore: round(avgFeedbackScore),
    avgMetricScore: round(avgMetricScore),
  };

  return {
    employeeSuggestions: ensured.suggestions,
    suggestionsChanged: ensured.changed,
    coachingProfiles: calibratedCoachingProfiles,
    teamMetrics: calibratedTeamMetrics,
    extendedMetrics: calibratedExtendedMetrics,
    finalScore,
    primaryMetrics,
    secondaryMetrics,
    breakdown: {
      ...primaryMetrics,
      ...secondaryMetrics,
    },
    category: getPerformanceCategory(finalScore),
    counts: {
      employees: employees.length,
      feedbacks: feedbacks.length,
      metrics: metrics.length,
    },
    progress: getActionableProgress(ensured.suggestions),
    scoreDelta: managerScoreDelta,
    impactTotals: aggregateImpactTotals,
  };
}

function calibrateAttritionPredictions(predictions = [], employeeSuggestions = []) {
  const impactMap = buildCompletedImpactMap(employeeSuggestions);

  return predictions.map((prediction) => {
    const impact = impactMap.get(prediction.employeeName) || {};
    const flightRisk = clamp(
      round(
        prediction.flightRisk +
        (impact.attritionRiskDelta || 0) -
        (impact.feedbackSentimentDelta || 0) * 20 -
        (impact.performanceRatingDelta || 0) * 6
      ),
      0,
      100
    );
    const impactScore = clamp(
      round(
        prediction.impactScore +
        (impact.performanceRatingDelta || 0) * 12 +
        (impact.achievementScoreDelta || 0) * 0.5 +
        (impact.runRateDelta || 0) * 0.3
      ),
      0,
      100
    );
    const completedItems = Object.values(impact).some((value) => Number(value) !== 0);

    return {
      ...prediction,
      flightRisk,
      impactScore,
      riskLevel: getLevel(flightRisk),
      impactLevel: getLevel(impactScore),
      rationale: completedItems
        ? `${prediction.rationale} Completed development actionables have been factored into this updated risk view.`
        : prediction.rationale,
      recommendation: completedItems && flightRisk < prediction.flightRisk
        ? "Keep reinforcing the completed actionables and add a follow-up checkpoint to sustain the risk reduction."
        : prediction.recommendation,
    };
  });
}

function buildFormulaAttritionPredictions({
  employees = [],
  feedbacks = [],
  extendedMetrics = {},
  employeeSuggestions = [],
}) {
  const predictions = employees.map((employee) => {
    const employeeFeedbacks = feedbacks.filter(
      (feedback) => feedback.fromEmployee === employee.name || feedback.employeeId?.toString() === employee._id?.toString()
    );
    const flightRisk = computeFormulaFlightRisk(employee, employeeFeedbacks, extendedMetrics);
    const impactScore = computeFormulaImpactScore(employee, employeeFeedbacks, employees.length);

    return {
      employeeName: employee.name,
      flightRisk,
      impactScore,
      riskLevel: getLevel(flightRisk),
      impactLevel: getLevel(impactScore),
      rationale: `Formula-based: ${getLevel(flightRisk)} flight risk derived from recent feedback, performance, and wellbeing signals.`,
      recommendation: flightRisk >= 70
        ? "Schedule an urgent check-in and align on support, growth, and retention actions."
        : flightRisk >= 40
          ? "Review progress regularly and reinforce development momentum."
          : "Maintain the current support plan and watch for sentiment changes.",
    };
  });

  return calibrateAttritionPredictions(predictions, employeeSuggestions);
}

function toggleActionableCompletion(employeeSuggestions = [], actionableId, completed, options = {}) {
  let changed = false;
  const suggestions = employeeSuggestions.map((employeeSuggestion) => ({
    ...employeeSuggestion,
    suggestions: (employeeSuggestion.suggestions || []).map((suggestion) => ({
      ...suggestion,
      actionables: (suggestion.actionables || []).map((actionable) => {
        if (actionable.id !== actionableId) return actionable;
        changed = true;
        return {
          ...actionable,
          impact: completed
            ? sanitizeKpiImpact(options.impact || actionable.impact || {})
            : sanitizeKpiImpact(actionable.impact || {}),
          completed,
          completedAt: completed ? new Date() : null,
          completionMetric: completed ? options.completionMetric || null : null,
          completionNote: completed ? options.completionNote || null : null,
          impactAppliedToDb: completed ? options.impactAppliedToDb === true : false,
          completedFormData: completed ? options.formData || null : null,
        };
      }),
    })),
  }));

  return { suggestions, changed };
}

module.exports = {
  buildCalibratedAnalytics,
  buildFormulaAttritionPredictions,
  calibrateAttritionPredictions,
  ensureEmployeeSuggestionsActionables,
  getActionableProgress,
  toggleActionableCompletion,
  sanitizeKpiImpact,
};
