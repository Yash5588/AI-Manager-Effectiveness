const express = require("express");
const router = express.Router();
const HR = require("../models/HR");
const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");

// Compute a manager's analytics
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

// Feedback query limits (same as analytics controller)
const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;
const FEEDBACK_SCORE_LIMIT = 50;

function getFeedbackDateFilter() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
    return { createdAt: { $gte: cutoff } };
}

async function computeManagerAnalytics(managerId) {
    const [employees, feedbacks, metrics, latestSnapshot, extendedMetrics] = await Promise.all([
        Employee.find({ managerId }),
        Feedback.find({ managerId, ...getFeedbackDateFilter() })
            .sort({ createdAt: -1 })
            .limit(FEEDBACK_SCORE_LIMIT),
        PerformanceMetric.find({ managerId }),
        ScoreSnapshot.findOne({ managerId, aiScore: { $exists: true } }).sort({ createdAt: -1 }),
        ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const avgEmployeeScore =
        employees.length > 0
            ? employees.reduce((s, e) => s + normalizeEmployeeScore(e.performanceRating), 0) / employees.length
            : 0.5;
    const avgFeedbackScore =
        feedbacks.length > 0
            ? feedbacks.reduce((s, f) => s + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
            : 0.5;
    const avgMetricScore =
        metrics.length > 0
            ? metrics.reduce((s, m) => s + normalizeMetricValue(m.value), 0) / metrics.length
            : 0.5;

    let breakdown = {
        avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
        avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
        avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    let finalScore;
    if (latestSnapshot) {
        finalScore = latestSnapshot.aiScore;
        if (latestSnapshot.aiBreakdown) {
            // Use AI breakdown if available
            breakdown = { ...breakdown, ...latestSnapshot.aiBreakdown };

            // Sync AI feedback sentiment with avgFeedbackScore
            if (latestSnapshot.aiBreakdown.feedbackSentiment !== undefined) {
                breakdown.avgFeedbackScore = latestSnapshot.aiBreakdown.feedbackSentiment / 100;
            }
        }
    } else {
        // Fallback to formula ONLY if no AI score has ever been computed
        finalScore = Math.round(
            (avgEmployeeScore * 0.4 + avgFeedbackScore * 0.3 + avgMetricScore * 0.3) * 100
        );
    }

    const category = getPerformanceCategory(finalScore);

    return {
        breakdown,
        extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
        finalScore,
        category,
        counts: {
            employees: employees.length,
            feedbacks: feedbacks.length,
            metrics: metrics.length,
        },
    };
}

// GET /api/hr/:hrId/managers — returns all managers assigned to this HR with analytics
router.get("/:hrId/managers", async (req, res) => {
    try {
        const { hrId } = req.params;
        const managers = await Manager.find({ hrId }).select("-password");

        // Compute analytics for each manager
        const managersWithAnalytics = await Promise.all(
            managers.map(async (mgr) => {
                const analytics = await computeManagerAnalytics(mgr._id);
                const sScore = analytics.breakdown.feedbackSentiment !== undefined
                    ? analytics.breakdown.feedbackSentiment / 100
                    : analytics.breakdown.avgFeedbackScore;

                return {
                    ...mgr.toObject(),
                    effectivenessScore: analytics.finalScore,
                    sentimentScore: sScore,
                    sentimentLabel:
                        sScore >= 0.6
                            ? "Positive"
                            : sScore <= 0.4
                                ? "Negative"
                                : "Neutral",
                    category: analytics.category,
                    breakdown: analytics.breakdown,
                    extendedMetrics: analytics.extendedMetrics,
                    counts: analytics.counts,
                };
            })
        );

        res.json(managersWithAnalytics);
    } catch (error) {
        console.error("HR managers error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/hr/:hrId/overview — returns aggregate stats for all managers under this HR
router.get("/:hrId/overview", async (req, res) => {
    try {
        const { hrId } = req.params;
        const managers = await Manager.find({ hrId });

        if (managers.length === 0) {
            return res.json({
                totalManagers: 0,
                totalEmployees: 0,
                avgEffectiveness: 0,
                avgSentiment: 0,
                managers: [],
            });
        }

        const managerIds = managers.map((m) => m._id);

        const [allEmployees, allFeedbacks] = await Promise.all([
            Employee.find({ managerId: { $in: managerIds } }),
            Feedback.find({ managerId: { $in: managerIds } }),
        ]);

        // Compute per-manager analytics
        const managerAnalytics = await Promise.all(
            managers.map(async (mgr) => {
                const analytics = await computeManagerAnalytics(mgr._id);
                return {
                    name: mgr.name,
                    department: mgr.department,
                    ...analytics,
                };
            })
        );

        const avgEffectiveness =
            managerAnalytics.reduce((s, m) => s + m.finalScore, 0) / managerAnalytics.length;
        const avgSentiment =
            managerAnalytics.reduce((s, m) => s + m.breakdown.avgFeedbackScore, 0) /
            managerAnalytics.length;

        res.json({
            totalManagers: managers.length,
            totalEmployees: allEmployees.length,
            totalFeedbacks: allFeedbacks.length,
            avgEffectiveness: Math.round(avgEffectiveness),
            avgSentiment: Math.round(avgSentiment * 100) / 100,
            managers: managerAnalytics,
        });
    } catch (error) {
        console.error("HR overview error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/hr/:hrId/hierarchy — returns full org hierarchy: HR → Managers → Employees
router.get("/:hrId/hierarchy", async (req, res) => {
    try {
        const { hrId } = req.params;
        const hr = await HR.findById(hrId).select("-password");
        if (!hr) return res.status(404).json({ message: "HR not found" });

        const managers = await Manager.find({ hrId }).select("-password");

        const hierarchy = await Promise.all(
            managers.map(async (mgr) => {
                const employees = await Employee.find({ managerId: mgr._id }).select("-password");
                const analytics = await computeManagerAnalytics(mgr._id);

                return {
                    id: mgr._id,
                    name: mgr.name,
                    department: mgr.department,
                    email: mgr.email,
                    experienceYears: mgr.experienceYears,
                    effectivenessScore: analytics.finalScore,
                    category: analytics.category,
                    sentimentScore: analytics.breakdown.avgFeedbackScore,
                    employees: employees.map((emp) => ({
                        id: emp._id,
                        name: emp.name,
                        role: emp.role,
                        performanceRating: emp.performanceRating,
                        email: emp.email,
                    })),
                };
            })
        );

        res.json({
            hr: {
                id: hr._id,
                name: hr.name,
                email: hr.email,
                department: hr.department,
                designation: hr.designation,
            },
            managers: hierarchy,
        });
    } catch (error) {
        console.error("HR hierarchy error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/hr/:hrId/leaderboard — returns managers ranked by effectiveness and sentiment
router.get("/:hrId/leaderboard", async (req, res) => {
    try {
        const { hrId } = req.params;
        const managers = await Manager.find({ hrId }).select("-password");

        const leaderboard = await Promise.all(
            managers.map(async (mgr) => {
                const analytics = await computeManagerAnalytics(mgr._id);

                // Get trend data (last 7 days)
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const recentSnapshots = await ScoreSnapshot.find({
                    managerId: mgr._id,
                    createdAt: { $gte: weekAgo },
                }).sort({ createdAt: 1 });

                let trend = 0;
                if (recentSnapshots.length >= 2) {
                    trend =
                        recentSnapshots[recentSnapshots.length - 1].finalScore -
                        recentSnapshots[0].finalScore;
                }

                return {
                    id: mgr._id,
                    name: mgr.name,
                    department: mgr.department,
                    email: mgr.email,
                    experienceYears: mgr.experienceYears,
                    effectivenessScore: analytics.finalScore,
                    sentimentScore: analytics.breakdown.avgFeedbackScore,
                    category: analytics.category,
                    counts: analytics.counts,
                    trend, // +/- change over last 7 days
                };
            })
        );

        // Sort by effectiveness score (descending)
        leaderboard.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

        // Add rank
        leaderboard.forEach((m, i) => {
            m.rank = i + 1;
        });

        res.json(leaderboard);
    } catch (error) {
        console.error("HR leaderboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
