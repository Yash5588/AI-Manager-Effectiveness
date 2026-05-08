const cron = require("node-cron");
const User = require("../models/User");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { computeAIInsights } = require("../services/aiScoringService");
const {
    fetchManagerScoringInputs,
    computeManagerScoreFromInputs,
    getPerformanceCategory,
    toPlainObject,
} = require("../services/managerAnalyticsService");

const FEEDBACK_AI_LIMIT = 20;

async function computeManagerSnapshot(managerId) {
    const [manager, inputs] = await Promise.all([
        User.findById(managerId),
        fetchManagerScoringInputs(managerId),
    ]);

    if (!manager) return null;

    const { employees, feedbacks, metrics, extendedMetrics } = inputs;
    const score = computeManagerScoreFromInputs(inputs);
    const finalScore = score.finalScore;
    const category = getPerformanceCategory(finalScore);
    const counts = score.counts;

    // Get qualitative insights from LLM (score is NOT influenced)
    let aiInsights = {};
    try {
        aiInsights = await computeAIInsights({
            manager: toPlainObject(manager),
            employees: employees.map(toPlainObject),
            feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(toPlainObject),
            metrics: metrics.map(toPlainObject),
            extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
            breakdown: score.formulaBreakdown,
            formulaScore: finalScore,
        });
    } catch (err) {
        console.error(`  ⚠️ AI insights failed for ${manager.name}:`, err.message);
    }

    await ScoreSnapshot.create({
        managerId,
        finalScore,
        breakdown: score.roundedAverages,
        category,
        counts,
        aiScore: finalScore,
        aiBreakdown: score.formulaBreakdown,
        aiReasoning: aiInsights.aiReasoning || null,
        aiStrengths: aiInsights.aiStrengths || [],
        aiWeaknesses: aiInsights.aiWeaknesses || [],
    });

    return { manager: manager.name, score: finalScore, category };
}

async function computeWeeklySnapshots() {
    try {
        const managers = await User.find({ userType: "manager" });
        console.log(`📊 Weekly snapshot job: Processing ${managers.length} manager(s)`);

        for (const mgr of managers) {
            try {
                const result = await computeManagerSnapshot(mgr._id);
                if (result) {
                    console.log(`  ✓ ${result.manager}: ${result.score}/100 (${result.category})`);
                }
            } catch (err) {
                console.error(`  ✗ Failed snapshot for ${mgr.name}:`, err.message);
            }
        }

        console.log("📊 Weekly snapshot job completed");
    } catch (err) {
        console.error("Weekly snapshot job failed:", err.message);
    }
}

cron.schedule("30 20 * * 0", async () => {
    console.log("── Weekly snapshot cron started ──");
    await computeWeeklySnapshots();
});

console.log("📊 Weekly snapshot cron registered (every Monday 2:00 AM IST)");

module.exports = { computeWeeklySnapshots };