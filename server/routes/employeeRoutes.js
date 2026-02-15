const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");

// CREATE employee
router.post("/", async (req, res) => {
  const employee = await Employee.create(req.body);
  res.json(employee);
});

// GET employees by manager
router.get("/manager/:managerId", async (req, res) => {
  const employees = await Employee.find({
    managerId: req.params.managerId
  });
  res.json(employees);
});

module.exports = router;
