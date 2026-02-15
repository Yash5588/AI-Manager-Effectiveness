const express = require("express");
const router = express.Router();
const PerformanceMetric = require("../models/PerformanceMetric");

// CREATE metric
router.post("/", async (req, res) => {
  const metric = await PerformanceMetric.create(req.body);
  res.json(metric);
});

// GET metrics by manager
router.get("/manager/:managerId", async (req, res) => {
  const metrics = await PerformanceMetric.find({
    managerId: req.params.managerId
  });
  res.json(metrics);
});

module.exports = router;
