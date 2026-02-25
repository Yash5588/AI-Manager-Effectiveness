const mongoose = require("mongoose");

const ScoreSnapshotSchema = new mongoose.Schema(
    {
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Manager",
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
    },
    { timestamps: true }
);

// Compound index for efficient queries: get a manager's history sorted by date
ScoreSnapshotSchema.index({ managerId: 1, createdAt: -1 });

module.exports = mongoose.model("ScoreSnapshot", ScoreSnapshotSchema);
