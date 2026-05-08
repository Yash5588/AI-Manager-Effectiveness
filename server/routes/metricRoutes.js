const express = require("express");
const router = express.Router();
const PerformanceMetric = require("../models/PerformanceMetric");

// CREATE metric
router.post("/", async (req, res) => {
  try {
    const metric = await PerformanceMetric.create(req.body);
    res.json(metric);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create metric" });
  }
});

// GET metrics by manager
router.get("/manager/:managerId", async (req, res) => {
  try {
    const metrics = await PerformanceMetric.find({
      managerId: req.params.managerId
    });
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch metrics" });
  }
});

module.exports = router;
