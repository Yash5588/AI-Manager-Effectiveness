const express = require("express");
const router = express.Router();
const Manager = require("../models/Manager");
const Employee = require("../models/Employee");
const HR = require("../models/HR");
const { generateToken } = require("../middleware/auth");

// POST /api/auth/login
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

        if (role === "hr") {
            const hr = await HR.findOne({ email });
            if (!hr) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const isMatch = await hr.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password" });
            }

            const token = generateToken({
                id: hr._id,
                email: hr.email,
                name: hr.name,
                role: "hr"
            });

            return res.json({
                token,
                user: {
                    id: hr._id,
                    name: hr.name,
                    email: hr.email,
                    department: hr.department,
                    designation: hr.designation,
                    role: "hr"
                }
            });
        }

        return res.status(400).json({ message: "Invalid role. Must be 'manager', 'employee', or 'hr'" });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
