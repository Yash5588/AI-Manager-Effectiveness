const express = require("express");
const router = express.Router();
const User = require("../models/User");
router.get("/test", (req, res) => res.json({ message: "HR Routes are alive!" }));
const Feedback = require("../models/Feedback");
const {
    computeManagerAnalytics,
    computeRecentTrend,
} = require("../services/managerAnalyticsService");

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

// GET /api/hr/:hrId/overview 
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

// GET /api/hr/:hrId/hierarchy 
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

// GET /api/hr/:hrId/leaderboard 
router.get("/:hrId/leaderboard", async (req, res) => {
    try {
        const { hrId } = req.params;
        const managers = await User.find({ hrId, userType: "manager" }).select("-password");

        const leaderboard = await Promise.all(
            managers.map(async (mgr) => {
                const analytics = await computeManagerAnalytics(mgr._id);
                const trend = await computeRecentTrend(mgr._id, 2);

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
        const { sendAllReports } = require("../schedulers/emailScheduler"); //lazy require
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
