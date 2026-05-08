const express = require("express");
const router = express.Router();
const User = require("../models/User");
router.get("/test", (req, res) => res.json({ message: "HR Routes are alive!" }));
const Feedback = require("../models/Feedback");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const EmployeeSuggestionsCache = require("../models/EmployeeSuggestionsCache");
const { buildCalibratedAnalytics } = require("../services/employeeActionablesService");
const {
    computeManagerAnalytics,
    computeRecentTrend,
    getFeedbackDateFilter,
    toObjectId,
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
                const [employees, feedbacks, extendedMetrics, analytics] = await Promise.all([
                    User.find({ managerId: mgr._id, userType: "employee" }).select("-password").lean(),
                    Feedback.find({ managerId: toObjectId(mgr._id), ...getFeedbackDateFilter() }).lean(),
                    ManagerExtendedMetrics.findOne({ managerId: mgr._id }).lean(),
                    computeManagerAnalytics(mgr._id),
                ]);
                const suggestionCache = await EmployeeSuggestionsCache.findOne({ managerId: mgr._id })
                    .sort({ createdAt: -1 })
                    .lean();

                const coaching = buildCalibratedAnalytics({
                    employees,
                    feedbacks,
                    metrics: [],
                    extendedMetrics: extendedMetrics || {},
                    employeeSuggestions: suggestionCache?.suggestions || [],
                });
                const profileMap = new Map();
                coaching.coachingProfiles.forEach(p => profileMap.set(p._id.toString(), p));

                const computeEES = (profile) => {
                    const achievement = profile.achievementScore || 0;
                    const runRate = profile.runRate || 0;
                    const retention = 100 - (profile.attritionRisk || 0);
                    const sentiment = (profile.feedbackSentiment || 0) * 100;
                    const rating = ((profile.performanceRating || 0) / 5) * 100;
                    const engagement = Math.min(100, (profile.feedbackCount || 0) * 20);
                    return Math.round(
                        achievement * 0.25 +
                        runRate * 0.20 +
                        retention * 0.15 +
                        sentiment * 0.15 +
                        rating * 0.15 +
                        engagement * 0.10
                    );
                };

                return {
                    id: mgr._id,
                    name: mgr.name,
                    department: mgr.department,
                    email: mgr.email,
                    experienceYears: mgr.experienceYears,
                    effectivenessScore: analytics.finalScore,
                    category: analytics.category,
                    sentimentScore: analytics.breakdown.avgFeedbackScore,
                    employees: employees.map((emp) => {
                        const profile = profileMap.get(emp._id.toString());
                        const ees = profile ? computeEES(profile) : 0;
                        return {
                            id: emp._id,
                            name: emp.name,
                            role: emp.role,
                            performanceRating: emp.performanceRating,
                            ees,
                            email: emp.email,
                        };
                    }),
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

// GET /api/hr/:hrId/download-report — download the HR report as an HTML file
router.get("/:hrId/download-report", async (req, res) => {
    try {
        const { generateHRReport } = require("../services/reportService");
        const report = await generateHRReport(req.params.hrId);
        res.setHeader("Content-Type", "text/html");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="HR_Report_${new Date().toISOString().slice(0, 10)}.html"`
        );
        res.send(report.html);
    } catch (error) {
        console.error("Download report error:", error);
        res.status(500).json({ message: "Failed to generate report" });
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
