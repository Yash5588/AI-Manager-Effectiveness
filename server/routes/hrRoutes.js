const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/test", (req, res) => res.json({ message: "HR Routes are alive!" }));
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
    const mongoose = require("mongoose");
    const [employees, latestFeedbacks, metrics, latestSnapshot, extendedMetrics] = await Promise.all([
        User.find({ managerId, userType: "employee" }),
        Feedback.aggregate([
            { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { createdAt: -1 } },
        ]),
        PerformanceMetric.find({ managerId }),
        ScoreSnapshot.findOne({ managerId, aiScore: { $exists: true } }).sort({ createdAt: -1 }),
        ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const feedbacks = latestFeedbacks;

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
            breakdown = { ...breakdown, ...latestSnapshot.aiBreakdown };
            if (latestSnapshot.aiBreakdown.feedbackSentiment !== undefined) {
                breakdown.avgFeedbackScore = latestSnapshot.aiBreakdown.feedbackSentiment / 100;
            }
        }
    } else {
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
        const managers = await User.find({ hrId, userType: "manager" }).select("-password");

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
        const managers = await User.find({ hrId, userType: "manager" });

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
            User.find({ managerId: { $in: managerIds }, userType: "employee" }),
            Feedback.find({ managerId: { $in: managerIds } }),
        ]);

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
        const hr = await User.findById(hrId).select("-password");
        if (!hr) return res.status(404).json({ message: "HR not found" });

        const managers = await User.find({ hrId, userType: "manager" }).select("-password");

        const hierarchy = await Promise.all(
            managers.map(async (mgr) => {
                const employees = await User.find({ managerId: mgr._id, userType: "employee" }).select("-password");
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
        const managers = await User.find({ hrId, userType: "manager" }).select("-password");

        const leaderboard = await Promise.all(
            managers.map(async (mgr) => {
                const analytics = await computeManagerAnalytics(mgr._id);

                const twoMonthsAgo = new Date();
                twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
                const recentSnapshots = await ScoreSnapshot.find({
                    managerId: mgr._id,
                    createdAt: { $gte: twoMonthsAgo },
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
                    trend,
                };
            })
        );

        leaderboard.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
        leaderboard.forEach((m, i) => {
            m.rank = i + 1;
        });

        res.json(leaderboard);
    } catch (error) {
        console.error("HR leaderboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// POST /api/hr/:hrId/send-reports — manually trigger monthly email reports for all
router.post("/:hrId/send-reports", async (req, res) => {
    try {
        const { sendAllReports } = require("../schedulers/emailScheduler");
        await sendAllReports(req.params.hrId);
        res.json({ message: "Reports sent successfully to your managers" });
    } catch (error) {
        console.error("Send reports error:", error);
        res.status(500).json({ message: "Failed to send reports" });
    }
});

// POST /api/hr/:hrId/send-report/:managerId — send report to a single manager
router.post("/:hrId/send-report/:managerId", async (req, res) => {
    try {
        const { generateHRReport, generateManagerReport } = require("../services/reportService");
        const { sendEmail } = require("../services/emailService");

        const mgrReport = await generateManagerReport(req.params.managerId);
        await sendEmail(mgrReport.to, mgrReport.subject, mgrReport.html);

        res.json({ message: `Report sent to ${mgrReport.to}` });
    } catch (error) {
        console.error("Send single report error:", error);
        res.status(500).json({ message: "Failed to send report" });
    }
});

module.exports = router;
