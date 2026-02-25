const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const Employee = require("../models/Employee");
const Manager = require("../models/Manager");
const { authMiddleware, requireRole } = require("../middleware/auth");
const { analyzeSentiment } = require("../services/aiSuggestionsService");

/**
 * POST /api/feedback/submit
 * Employee submits feedback about their manager.
 * Sentiment score is calculated via AI before storing.
 * Protected: only authenticated employees.
 */
router.post("/submit", authMiddleware, requireRole("employee"), async (req, res) => {
  try {
    const { comment } = req.body;
    const employeeId = req.user.id;
    const managerId = req.user.managerId;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: "Feedback comment is required" });
    }

    // Get employee name
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Get manager to verify they exist
    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Calculate sentiment score via AI
    console.log(`📝 Analyzing sentiment for feedback from ${employee.name}...`);
    let sentimentScore;
    try {
      sentimentScore = await analyzeSentiment(comment);
      console.log(`✅ Sentiment score: ${sentimentScore}`);
    } catch (err) {
      console.error("Sentiment analysis failed, using default:", err.message);
      sentimentScore = 0.5; // default neutral if AI fails
    }

    // Store feedback
    const feedback = await Feedback.create({
      fromEmployee: employee.name,
      employeeId: employee._id,
      comment: comment.trim(),
      sentimentScore,
      managerId,
    });

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback: {
        id: feedback._id,
        comment: feedback.comment,
        sentimentScore: feedback.sentimentScore,
        managerName: manager.name,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Feedback submit error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

/**
 * GET /api/feedback/my-feedbacks
 * Employee views their own submitted feedbacks.
 * Protected: only authenticated employees.
 */
router.get("/my-feedbacks", authMiddleware, requireRole("employee"), async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ employeeId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    // Get manager name for each feedback
    const managerIds = [...new Set(feedbacks.map(f => f.managerId.toString()))];
    const managers = await Manager.find({ _id: { $in: managerIds } }).lean();
    const managerMap = {};
    managers.forEach(m => { managerMap[m._id.toString()] = m.name; });

    const result = feedbacks.map(f => ({
      ...f,
      managerName: managerMap[f.managerId.toString()] || "Unknown"
    }));

    res.json(result);
  } catch (error) {
    console.error("My feedbacks error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// CREATE feedback (legacy — kept for seed/admin use)
router.post("/", async (req, res) => {
  try {
    const feedback = await Feedback.create(req.body);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET feedback by manager (ANONYMOUS: exclude employee names/IDs)
router.get("/manager/:managerId", async (req, res) => {
  try {
    const feedbacks = await Feedback.find({
      managerId: req.params.managerId
    })
      .select("-fromEmployee -employeeId") // Identity security: Strip names and IDs
      .sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
});

module.exports = router;
