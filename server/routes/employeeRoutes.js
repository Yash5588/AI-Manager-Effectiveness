const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Feedback = require("../models/Feedback");

// CREATE employee
router.post("/", async (req, res) => {
  try {
    const employee = await User.create({ ...req.body, userType: "employee" });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create employee" });
  }
});

// GET employees by manager (includes feedback given by each employee)
router.get("/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;
    const employees = await User.find({ managerId, userType: "employee" }).lean();
    const feedbacks = await Feedback.find({ managerId }).lean();

    const employeesWithData = employees.map((emp) => ({
      ...emp,
      feedbacks: feedbacks.filter((f) => f.fromEmployee === emp.name),
    }));

    res.json(employeesWithData);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch employees" });
  }
});

module.exports = router;
