const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { computeAIScore } = require("../services/aiScoringService");

const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;
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


async function computeManagerSnapshot(managerId) {
    const [manager, employees, latestFeedbacks, metrics, extendedMetrics] = await Promise.all([
        User.findById(managerId),
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

    if (!manager) return null;

    const feedbacks = latestFeedbacks;

    const avgEmployeeScore = employees.length > 0
        ? employees.reduce((s, e) => s + normalizeEmployeeScore(e.performanceRating), 0) / employees.length
        : 0.5;
    const avgFeedbackScore = feedbacks.length > 0
        ? feedbacks.reduce((s, f) => s + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
        : 0.5;
    const avgMetricScore = metrics.length > 0
        ? metrics.reduce((s, m) => s + normalizeMetricValue(m.value), 0) / metrics.length
        : 0.5;

    const breakdown = {
        avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
        avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
        avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    const { computeExtendedScore, computeFinalScore } = require("../utils/scoring");
    const avgExtendedScore = computeExtendedScore(extendedMetrics, employees.length);

    const formulaScore = computeFinalScore(breakdown, {}, avgExtendedScore);

    const counts = {
        employees: employees.length,
        feedbacks: feedbacks.length,
        metrics: metrics.length,
    };

    const aiResult = await computeAIScore({
        manager: manager.toObject ? manager.toObject() : manager,
        employees: employees.map(e => (e.toObject ? e.toObject() : e)),
        feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(f => (f.toObject ? f.toObject() : f)),
        metrics: metrics.map(m => (m.toObject ? m.toObject() : m)),
        extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
        breakdown,
        formulaScore,
    });

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

    return { manager: manager.name, score: aiResult.aiScore, category };
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
