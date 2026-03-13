const mongoose = require("mongoose");

const touchpointSchema = new mongoose.Schema({
    week: Number,
    action: String,
    impact: { type: String, enum: ["high", "medium", "low"], default: "medium" },
}, { _id: false });

const roadmapItemSchema = new mongoose.Schema({
    metricKey: String,
    metricLabel: String,
    currentScore: Number,
    severity: { type: String, enum: ["critical", "warning"], default: "warning" },
    predictedReasons: [String],
    touchpoints: [touchpointSchema],
    suggestion: String,
    milestoneTarget: Number,
    estimatedWeeks: Number,
}, { _id: false });

const improvementRoadmapSchema = new mongoose.Schema({
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roadmap: [roadmapItemSchema],
    message: String,
}, { timestamps: true });

module.exports = mongoose.model("ImprovementRoadmap", improvementRoadmapSchema);
