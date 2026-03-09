/**
 * Normalize extended metrics (5 percentage fields + IDP count) into a 0-1 score.
 * IDP value is the count of employees with active development goals.
 */
function computeExtendedScore(ext, employeeCount) {
    if (!ext) return 0.5;

    const pctFields = [
        ext.teamRetentionRate,
        ext.goalCompletionRate,
        ext.employeePromotionRate,
        ext.subordinate360Rating,
        ext.employeeEngagementScore,
    ];

    const validPct = pctFields.filter(v => v != null);
    const avgPct = validPct.length > 0
        ? validPct.reduce((s, v) => s + v / 100, 0) / validPct.length
        : 0.5;

    // IDP: ratio of employees with dev goals vs total team, capped at 1
    const idpNorm = ext.IDP != null && employeeCount > 0
        ? Math.min(1, ext.IDP / employeeCount)
        : 0.5;

    // Weighted: 80% from percentage metrics, 20% from IDP ratio
    return avgPct * 0.8 + idpNorm * 0.2;
}

/**
 * Compute the final effectiveness score using weighted components.
 * Default weights: 20% Employee, 20% Feedback, 20% KPI, 40% Extended Metrics.
 */
function computeFinalScore(breakdown, weights = {}, avgExtendedScore) {
    const { avgEmployeeScore, avgFeedbackScore, avgMetricScore } = breakdown;
    const {
        employee = 0.2,
        feedback = 0.2,
        metrics = 0.2,
        extended = 0.4
    } = weights;

    const extScore = avgExtendedScore ?? 0.5;

    const raw =
        avgEmployeeScore * employee +
        avgFeedbackScore * feedback +
        avgMetricScore * metrics +
        extScore * extended;

    return Math.round(raw * 100);
}

module.exports = {
    computeExtendedScore,
    computeFinalScore
};
