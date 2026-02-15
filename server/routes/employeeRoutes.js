const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const Feedback = require("../models/Feedback");

// CREATE employee
router.post("/", async (req, res) => {
  const employee = await Employee.create(req.body);
  res.json(employee);
});

// GET employees by manager (includes feedback given by each employee)
router.get("/manager/:managerId", async (req, res) => {
  const { managerId } = req.params;
  const employees = await Employee.find({ managerId }).lean();
  const feedbacks = await Feedback.find({ managerId }).lean();

  const employeesWithData = employees.map((emp) => ({
    ...emp,
    feedbacks: feedbacks.filter((f) => f.fromEmployee === emp.name),
  }));

  res.json(employeesWithData);
});

module.exports = router;
