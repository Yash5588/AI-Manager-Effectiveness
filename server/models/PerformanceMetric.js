const mongoose = require("mongoose");

const PerformanceMetricSchema = new mongoose.Schema(
  {
    metricName: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PerformanceMetric",
  PerformanceMetricSchema
);
