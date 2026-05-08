const mongoose = require("mongoose");

const ManagerExtendedMetricsSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        teamRetentionRate: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        goalCompletionRate: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        employeePromotionRate: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        //MSF 360 degree feedback process
        subordinate360Rating: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        //pulse:  vibe module
        employeeEngagementScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        // IDP: count of employees with at least one active development goal (must be >= 1)
        IDP: {
            type: Number,
            min: 1,
            required: true,
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ManagerExtendedMetrics", ManagerExtendedMetricsSchema);
