const express = require("express");
const router = express.Router();
const {
  getManagerAnalytics,
  generateSuggestions,
  generateEmployeeSuggestionsHandler,
  getAttritionPredictions,
  generateImprovementRoadmapHandler,
  getEmployeeCoachingData,
  updateEmployeeSuggestionActionableHandler,
  getManagerLeaderboard,
  getPeerTrendBenchmark,
  getPeerComparison,
  getTeamsTranscriptSentiment,
  getTeamsTranscriptCache,
} = require("../controllers/managerAnalyticsController");

router.get("/:managerId", getManagerAnalytics);
router.get("/:managerId/employee-coaching", getEmployeeCoachingData);
router.get("/:managerId/leaderboard", getManagerLeaderboard);
router.get("/:managerId/peer-trends", getPeerTrendBenchmark);
router.get("/:managerId/teams-sentiment", getTeamsTranscriptSentiment);
router.get("/:managerId/teams-sentiment-cache", getTeamsTranscriptCache);
router.post("/:managerId/suggestions", generateSuggestions);
router.post("/:managerId/employee-suggestions", generateEmployeeSuggestionsHandler);
router.patch("/:managerId/employee-suggestions/actionables/:actionableId", updateEmployeeSuggestionActionableHandler);
router.post("/:managerId/attrition-risk", getAttritionPredictions);
router.post("/:managerId/improvement-roadmap", generateImprovementRoadmapHandler);
router.post("/:managerId/peer-comparison", getPeerComparison);

// GET /api/manager-analytics/:managerId/download-report — download manager report as HTML
router.get("/:managerId/download-report", async (req, res) => {
  try {
    const { generateManagerReport } = require("../services/reportService");
    const report = await generateManagerReport(req.params.managerId);
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Manager_Report_${new Date().toISOString().slice(0, 10)}.html"`
    );
    res.send(report.html);
  } catch (error) {
    console.error("Download manager report error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// POST /api/manager-analytics/:managerId/send-report — email report to the manager
router.post("/:managerId/send-report", async (req, res) => {
  try {
    const { generateManagerReport } = require("../services/reportService");
    const { sendEmail } = require("../services/emailService");
    const report = await generateManagerReport(req.params.managerId);
    await sendEmail(report.to, report.subject, report.html);
    res.json({ message: `Report sent to ${report.to}` });
  } catch (error) {
    console.error("Send manager report error:", error);
    res.status(500).json({ message: "Failed to send report" });
  }
});

module.exports = router;
