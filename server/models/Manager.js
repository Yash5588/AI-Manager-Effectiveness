const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    password: {
      type: String,
      required: true
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

// Hash password before saving
ManagerSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
ManagerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Manager", ManagerSchema);
