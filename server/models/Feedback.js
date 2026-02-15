const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema(
  {
    fromEmployee: {
      type: String,
      required: true
    },
    comment: {
      type: String,
      required: true
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1,
      required: true
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
