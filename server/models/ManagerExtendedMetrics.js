const mongoose = require("mongoose");

const ManagerExtendedMetricsSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Manager",
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
        oneOnOneFrequency: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        employeeGrowthRate: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        responseTimeScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        peerReviewScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        projectDeliveryTimeliness: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        employeeEngagementScore: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
        trainingInvestment: {
            type: Number,
            min: 0,
            max: 100,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ManagerExtendedMetrics", ManagerExtendedMetricsSchema);
