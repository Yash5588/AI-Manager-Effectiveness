const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
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
        userType: {
            type: String,
            required: true,
            enum: ["hr", "manager", "employee"],
        },

        department: {
            type: String,
        },
        experienceYears: {
            type: Number,
        },
        hrId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        designation: {
            type: String,
            default: "HR Admin",
        },

        role: {
            type: String,
        },
        performanceRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        managerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

UserSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
