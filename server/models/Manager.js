const mongoose = require("mongoose");

const ManagerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    department: {
      type: String,
      required: true
    },
    experienceYears: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Manager", ManagerSchema);
