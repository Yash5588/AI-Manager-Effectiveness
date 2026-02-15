const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);

module.exports = router;
