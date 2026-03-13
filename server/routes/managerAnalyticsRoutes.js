const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
  generateEmployeeSuggestionsHandler,
  getAttritionPredictions,
  generateImprovementRoadmapHandler,
  getEmployeeCoachingData,
  getManagerLeaderboard,
  getPeerTrendBenchmark,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.get("/:managerId/employee-coaching", getEmployeeCoachingData);
router.get("/:managerId/leaderboard", getManagerLeaderboard);
router.get("/:managerId/peer-trends", getPeerTrendBenchmark);
router.post("/:managerId/suggestions", generateSuggestions);
router.post("/:managerId/employee-suggestions", generateEmployeeSuggestionsHandler);
router.post("/:managerId/attrition-risk", getAttritionPredictions);
router.post("/:managerId/improvement-roadmap", generateImprovementRoadmapHandler);

module.exports = router;
