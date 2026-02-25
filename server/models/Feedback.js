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
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", FeedbackSchema);
