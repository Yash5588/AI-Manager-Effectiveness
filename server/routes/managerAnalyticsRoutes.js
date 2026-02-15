const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.post("/:managerId/suggestions", generateSuggestions);

module.exports = router;
