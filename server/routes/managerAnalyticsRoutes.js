const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
  generateEmployeeSuggestionsHandler,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.post("/:managerId/suggestions", generateSuggestions);
router.post("/:managerId/employee-suggestions", generateEmployeeSuggestionsHandler);

module.exports = router;
