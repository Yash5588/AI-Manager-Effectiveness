const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    performanceRating: {
      type: Number,
      min: 1,
      max: 5,
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

module.exports = mongoose.model("Employee", EmployeeSchema);
