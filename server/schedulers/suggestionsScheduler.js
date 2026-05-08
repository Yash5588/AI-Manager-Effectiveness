const cron = require("node-cron");
const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const EmployeeSuggestionsCache = require("../models/EmployeeSuggestionsCache");
const { generateEmployeeSuggestions } = require("../services/aiSuggestionsService");
const { buildEmployeeCoachingProfiles } = require("../services/employeeCoachingService");
const {
    computeManagerScoreFromInputs,
    getFeedbackDateFilter,
    toObjectId,
    toPlainObject,
} = require("../services/managerAnalyticsService");

const FEEDBACK_AI_LIMIT = 20;

async function regenerateForManager(manager) {
    const managerId = manager._id;

    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
        User.find({ managerId, userType: "employee" }).lean(),
        Feedback.find({
            managerId: toObjectId(managerId),
            ...getFeedbackDateFilter(),
        }).lean(),
        PerformanceMetric.find({ managerId }),
        ManagerExtendedMetrics.findOne({ managerId }).lean(),
    ]);

    const { finalScore } = computeManagerScoreFromInputs({
        employees, feedbacks, metrics, extendedMetrics,
    });

    const coachingData = buildEmployeeCoachingProfiles({
        employees, feedbacks, extendedMetrics,
    });

    const payload = {
        manager: toPlainObject(manager),
        coachingProfiles: coachingData.employees,
        teamMetrics: coachingData.teamMetrics,
        feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT),
        finalScore,
    };

    const suggestions = await generateEmployeeSuggestions(payload);

    await EmployeeSuggestionsCache.findOneAndUpdate(
        { managerId },
        { managerId, suggestions, currentScore: finalScore },
        { upsert: true, new: true }
    );

    return { name: manager.name, score: finalScore };
}

async function regenerateAllSuggestions() {
    try {
        const managers = await User.find({ userType: "manager" });
        console.log(`🤖 Weekly suggestions job: Processing ${managers.length} manager(s)`);

        for (const mgr of managers) {
            try {
                const result = await regenerateForManager(mgr);
                console.log(`  ✓ Suggestions cached for ${result.name} (score: ${result.score})`);
            } catch (err) {
                console.error(`  ✗ Failed suggestions for ${mgr.name}:`, err.message);
            }
        }

        console.log("🤖 Weekly suggestions job completed");
    } catch (err) {
        console.error("Weekly suggestions job failed:", err.message);
    }
}

// Every Sunday at 9:00 PM UTC (Monday 2:30 AM IST)
cron.schedule("0 21 * * 0", async () => {
    console.log("── Weekly suggestions cron started ──");
    await regenerateAllSuggestions();
});

console.log("🤖 Weekly suggestions cron registered (every Sunday 9:00 PM UTC)");

module.exports = { regenerateAllSuggestions };
