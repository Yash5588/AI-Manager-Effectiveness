const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { generateToken } = require("../middleware/auth");

// POST /api/auth/login — auto-detects role from credentials
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const tokenPayload = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.userType,
        };

        if (user.userType === "employee") {
            tokenPayload.managerId = user.managerId;
        }

        const token = generateToken(tokenPayload);

        const responseUser = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.userType,
        };

        if (user.userType === "manager") {
            responseUser.department = user.department;
        } else if (user.userType === "hr") {
            responseUser.department = user.department;
            responseUser.designation = user.designation;
        } else if (user.userType === "employee") {
            responseUser.jobRole = user.role;
            responseUser.managerId = user.managerId;
        }

        return res.json({ token, user: responseUser });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
