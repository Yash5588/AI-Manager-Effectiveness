const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const HRSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        department: {
            type: String,
            default: "Human Resources",
        },
        designation: {
            type: String,
            default: "HR Admin",
        },
    },
    { timestamps: true }
);

// Hash password before saving
HRSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
HRSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("HR", HRSchema);
