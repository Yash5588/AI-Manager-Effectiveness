/**
 * 9-Dimension Manager Effectiveness Scoring Formula
 *
 * Dimensions and default weights:
 *   1. employeePerformance  - 12%  (avg employee rating, normalized 0-1)
 *   2. feedbackSentiment    - 13%  (avg composite feedback score, 0-1)
 *   3. kpiMetrics           - 12%  (avg KPI metric value / 100, 0-1)
 *   4. teamRetention        - 10%  (teamRetentionRate / 100)
 *   5. goalCompletion       - 10%  (goalCompletionRate / 100)
 *   6. employeePromotion    -  8%  (employeePromotionRate / 100)
 *   7. subordinate360       - 12%  (subordinate360Rating / 100)
 *   8. engagement           - 12%  (employeeEngagementScore / 100)
 *   9. idpScore             -  8%  (min(1, IDP / totalEmployees))
 *
 * Missing dimensions have their weight redistributed proportionally.
 */

const DIMENSION_WEIGHTS = {
    employeePerformance: 0.12,
    feedbackSentiment: 0.13,
    kpiMetrics: 0.12,
    teamRetention: 0.10,
    goalCompletion: 0.10,
    employeePromotion: 0.08,
    subordinate360: 0.12,
    engagement: 0.12,
    idpScore: 0.08,
};

/**
 * Compute the 9-dimension formula score and per-dimension breakdown.
 *
 * @param {Object} data
 * @param {number|null} data.avgEmployeeScore    - 0-1 (normalized employee perf avg)
 * @param {number|null} data.avgFeedbackScore    - 0-1 (avg composite feedback score)
 * @param {number|null} data.avgMetricScore      - 0-1 (avg KPI metric / 100)
 * @param {Object|null} data.extendedMetrics     - ManagerExtendedMetrics doc
 * @param {number}      data.employeeCount       - total employees (for IDP normalization)
 * @returns {{ finalScore: number, breakdown: Object }}
 */
function computeFormulaScore(data) {
    const {
        avgEmployeeScore,
        avgFeedbackScore,
        avgMetricScore,
        extendedMetrics,
        employeeCount = 0,
    } = data;

    const ext = extendedMetrics || {};

    // Build normalized values for each dimension (0-1), null if missing
    const dimensionValues = {
        employeePerformance: avgEmployeeScore != null ? avgEmployeeScore : null,
        feedbackSentiment: avgFeedbackScore != null ? avgFeedbackScore : null,
        kpiMetrics: avgMetricScore != null ? avgMetricScore : null,
        teamRetention: ext.teamRetentionRate != null ? ext.teamRetentionRate / 100 : null,
        goalCompletion: ext.goalCompletionRate != null ? ext.goalCompletionRate / 100 : null,
        employeePromotion: ext.employeePromotionRate != null ? ext.employeePromotionRate / 100 : null,
        subordinate360: ext.subordinate360Rating != null ? ext.subordinate360Rating / 100 : null,
        engagement: ext.employeeEngagementScore != null ? ext.employeeEngagementScore / 100 : null,
        idpScore: ext.IDP != null && employeeCount > 0
            ? Math.min(1, ext.IDP / employeeCount)
            : null,
    };

    // Calculate total available weight for redistribution
    let totalAvailableWeight = 0;
    for (const [key, val] of Object.entries(dimensionValues)) {
        if (val != null) {
            totalAvailableWeight += DIMENSION_WEIGHTS[key];
        }
    }

    // If nothing is available, return default 50
    if (totalAvailableWeight === 0) {
        const defaultBreakdown = {};
        for (const key of Object.keys(DIMENSION_WEIGHTS)) {
            defaultBreakdown[key] = 50;
        }
        return { finalScore: 50, breakdown: defaultBreakdown };
    }

    // Compute weighted score with proportional redistribution
    let weightedSum = 0;
    const breakdown = {};

    for (const [key, val] of Object.entries(dimensionValues)) {
        if (val != null) {
            const adjustedWeight = DIMENSION_WEIGHTS[key] / totalAvailableWeight;
            weightedSum += val * adjustedWeight;
            breakdown[key] = Math.round(val * 100);
        } else {
            breakdown[key] = 50; // default for missing dimensions
        }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(weightedSum * 100)));

    return { finalScore, breakdown };
}

module.exports = { computeFormulaScore, DIMENSION_WEIGHTS };
