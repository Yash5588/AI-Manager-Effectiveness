const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
  generateEmployeeSuggestionsHandler,
  getAIScore,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.get("/:managerId/ai-score", getAIScore);
router.post("/:managerId/suggestions", generateSuggestions);
router.post("/:managerId/employee-suggestions", generateEmployeeSuggestionsHandler);

module.exports = router;
