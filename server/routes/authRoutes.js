const express = require("express");
const router = express.Router();
const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const { generateToken } = require("../middleware/auth");

/**
 * POST /api/auth/login
 * Body: { email, password, role: "manager" | "employee" }
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ message: "Email, password, and role are required" });
        }

        if (role === "manager") {
            const manager = await Manager.findOne({ email });
            if (!manager) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const isMatch = await manager.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const token = generateToken({
                id: manager._id,
                email: manager.email,
                name: manager.name,
                role: "manager"
            });

            return res.json({
                token,
                user: {
                    id: manager._id,
                    name: manager.name,
                    email: manager.email,
                    department: manager.department,
                    role: "manager"
                }
            });
        }

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const isMatch = await employee.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const token = generateToken({
                id: employee._id,
                email: employee.email,
                name: employee.name,
                role: "employee",
                managerId: employee.managerId
            });

            return res.json({
                token,
                user: {
                    id: employee._id,
                    name: employee.name,
                    email: employee.email,
                    role: "employee",
                    jobRole: employee.role,
                    managerId: employee.managerId
                }
            });
        }

        return res.status(400).json({ message: "Invalid role. Must be 'manager' or 'employee'" });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * GET /api/auth/me
 * Returns the current user's profile based on JWT
 */
const { authMiddleware } = require("../middleware/auth");

router.get("/me", authMiddleware, async (req, res) => {
    try {
        if (req.user.role === "manager") {
            const manager = await Manager.findById(req.user.id).select("-password");
            if (!manager) return res.status(404).json({ message: "Manager not found" });
            return res.json({ ...manager.toObject(), role: "manager" });
        }

        if (req.user.role === "employee") {
            const employee = await Employee.findById(req.user.id).select("-password");
            if (!employee) return res.status(404).json({ message: "Employee not found" });
            return res.json({ ...employee.toObject(), role: "employee" });
        }

        res.status(400).json({ message: "Unknown role" });
    } catch (error) {
        console.error("Auth /me error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
