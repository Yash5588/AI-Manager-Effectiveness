const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    fromEmployee: {
      type: String,
      required: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    comment: {
      type: String,
      required: true
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1
    },

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

    npsScore: {
      type: Number,
      min: 0,
      max: 10
    },

    feedbackCategory: {
      type: String,
      enum: ["communication", "leadership", "technical", "culture", "growth", "worklife", "other"]
    },
    feedbackType: {
      type: String,
      enum: ["appreciation", "suggestion", "concern"]
    },

    pulseMood: {
      type: String,
      enum: ["thriving", "happy", "neutral", "stressed", "struggling"]
    },

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

    peerComparison: {
      type: String,
      enum: ["much_better", "better", "same", "worse", "much_worse"]
    },

    timePeriod: {
      type: String,
      enum: ["last_week", "last_month", "last_quarter", "overall"]
    },

    willingToFollowUp: {
      type: Boolean,
      default: false
    },

    urgency: {
      type: String,
      enum: ["low", "medium", "high"]
    },

    compositeFeedbackScore: {
      type: Number,
      min: 0,
      max: 1
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", FeedbackSchema);
