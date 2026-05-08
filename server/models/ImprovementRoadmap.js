const mongoose = require("mongoose");

const touchpointSchema = new mongoose.Schema(
    {
        week: {
            type: Number,
        },
        action: {
            type: String,
        },
        impact: {
            type: String,
            enum: ["high", "medium", "low"],
            default: "medium",
        },
    },
    { _id: false }
);

const roadmapItemSchema = new mongoose.Schema(
    {
        metricKey: {
            type: String,
        },
        metricLabel: {
            type: String,
        },
        currentScore: {
            type: Number,
        },
        severity: {
            type: String,
            enum: ["critical", "warning"],
            default: "warning",
        },
        predictedReasons: {
            type: [String],
        },
        touchpoints: [touchpointSchema],
        suggestion: {
            type: String,
        },
        milestoneTarget: {
            type: Number,
        },
        estimatedWeeks: {
            type: Number,
        },
    },
    { _id: false }
);

const improvementRoadmapSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: 1,
        },
        roadmap: [roadmapItemSchema],
        message: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ImprovementRoadmap", improvementRoadmapSchema);
