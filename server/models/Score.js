const mongoose = require("mongoose");

const ScoreSchema = new mongoose.Schema(
  {
    leadershipScore: Number,
    communicationScore: Number,
    efficiencyScore: Number,
    overallScore: Number,
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Score", ScoreSchema);
