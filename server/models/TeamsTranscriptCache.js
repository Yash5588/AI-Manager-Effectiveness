const mongoose = require("mongoose");

const employeeSentimentSchema = new mongoose.Schema({
    employeeId: String,
    employeeName: String,
    role: String,
    meetingCount: Number,
    chatCount: Number,
    overallSentiment: Number,
    sentimentLabel: { type: String, enum: ["Positive", "Neutral", "Negative"] },
    emotionalState: String,
    keyThemes: [String],
    topConcern: String,
    positiveSignal: String,
    riskFlag: Boolean,
    summary: String,
}, { _id: false });

const teamsTranscriptCacheSchema = new mongoose.Schema({
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    teamSentiment: Number,
    teamSentimentLabel: { type: String, enum: ["Positive", "Neutral", "Negative"] },
    employeesAnalyzed: Number,
    riskCount: Number,
    employees: [employeeSentimentSchema],
    analyzedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TeamsTranscriptCache", teamsTranscriptCacheSchema);
