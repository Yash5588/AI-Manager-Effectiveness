const mongoose = require("mongoose");

const ScoreSnapshotSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        finalScore: {
            type: Number,
            required: true,
        },
        breakdown: {
            avgEmployeeScore: { type: Number, required: true },
            avgFeedbackScore: { type: Number, required: true },
            avgMetricScore: { type: Number, required: true },
        },
        category: {
            type: String,
            required: true,
        },
        counts: {
            employees: { type: Number, default: 0 },
            feedbacks: { type: Number, default: 0 },
            metrics: { type: Number, default: 0 },
        },
        // Manager effectiveness score fields (from AI scoring)
        aiScore: {
            type: Number,
            min: 0,
            max: 100,
        },
        aiBreakdown: {
            type: mongoose.Schema.Types.Mixed,
        },
        aiReasoning: {
            type: String,
        },
        aiStrengths: {
            type: [String],
        },
        aiWeaknesses: {
            type: [String],
        },
    },
    { timestamps: true }
);

// Index for efficient manager score history queries
ScoreSnapshotSchema.index({ managerId: 1, createdAt: -1 });

module.exports = mongoose.model("ScoreSnapshot", ScoreSnapshotSchema);
