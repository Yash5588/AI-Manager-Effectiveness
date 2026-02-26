const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
  generateEmployeeSuggestionsHandler,
  getAIScore,
  getAttritionPredictions,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.get("/:managerId/ai-score", getAIScore);
router.post("/:managerId/suggestions", generateSuggestions);
router.post("/:managerId/employee-suggestions", generateEmployeeSuggestionsHandler);
router.post("/:managerId/attrition-risk", getAttritionPredictions);

module.exports = router;
