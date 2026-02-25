const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    fromEmployee: {
      type: String,
      required: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee"
    },
    comment: {
      type: String,
      required: true
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1
      // Not required — will be calculated by AI on submission
    },

    // ── Structured Rating Dimensions (1-5 stars) ──
    ratings: {
      communication: { type: Number, min: 1, max: 5 },
      recognition: { type: Number, min: 1, max: 5 },
      availability: { type: Number, min: 1, max: 5 },
      careerGrowth: { type: Number, min: 1, max: 5 },
      empowerment: { type: Number, min: 1, max: 5 },
      fairness: { type: Number, min: 1, max: 5 },
      decisionMaking: { type: Number, min: 1, max: 5 },
      conflictResolution: { type: Number, min: 1, max: 5 },
    },

    // ── NPS Score (0-10) ──
    npsScore: {
      type: Number,
      min: 0,
      max: 10
    },

    // ── Feedback Metadata ──
    feedbackCategory: {
      type: String,
      enum: ["communication", "leadership", "technical", "culture", "growth", "worklife", "other"]
    },
    feedbackType: {
      type: String,
      enum: ["appreciation", "suggestion", "concern"]
    },

    // ── Pulse Mood (emoji-based quick mood check) ──
    pulseMood: {
      type: String,
      enum: ["thriving", "happy", "neutral", "stressed", "struggling"]
    },

    // ── Behavioral / Frequency Questions ──
    oneOnOneFrequency: {
      type: String,
      enum: ["weekly", "biweekly", "monthly", "rarely", "never"]
    },
    feedbackFrequency: {
      type: String,
      enum: ["after_every_task", "weekly", "monthly", "rarely", "never"]
    },
    concernResponseTime: {
      type: String,
      enum: ["same_day", "within_week", "within_month", "rarely", "never"]
    },

    // ── Peer Comparison ──
    peerComparison: {
      type: String,
      enum: ["much_better", "better", "same", "worse", "much_worse"]
    },

    // ── Time Period Context ──
    timePeriod: {
      type: String,
      enum: ["last_week", "last_month", "last_quarter", "overall"]
    },

    // ── Follow-up Willingness ──
    willingToFollowUp: {
      type: Boolean,
      default: false
    },

    // ── Urgency Level ──
    urgency: {
      type: String,
      enum: ["low", "medium", "high"]
    },

    // ── Composite Feedback Score (computed at submission) ──
    compositeFeedbackScore: {
      type: Number,
      min: 0,
      max: 1
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", FeedbackSchema);
