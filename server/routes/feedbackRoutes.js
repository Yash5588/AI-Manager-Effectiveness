const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const User = require("../models/User");
const { authMiddleware, requireRole } = require("../middleware/auth");
const { analyzeSentiment } = require("../services/aiSuggestionsService");
const { computeCompositeFeedbackScore } = require("../services/feedbackScoringService");

// POST /api/feedback/submit — employee submits feedback
router.post("/submit", authMiddleware, requireRole("employee"), async (req, res) => {
  try {
    const {
      comment,
      ratings,
      npsScore,
      feedbackCategory,
      feedbackType,
      pulseMood,
      oneOnOneFrequency,
      feedbackFrequency,
      concernResponseTime,
      peerComparison,
      timePeriod,
      willingToFollowUp,
      urgency,
    } = req.body;

    const employeeId = req.user.id;
    const managerId = req.user.managerId;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ message: "Feedback comment is required" });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    //check for valid next feedback submission
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentFeedback = await Feedback.findOne({
      employeeId,
      managerId,
      createdAt: { $gte: oneWeekAgo },
    }).sort({ createdAt: -1 });

    if (recentFeedback) {
      const nextAllowed = new Date(recentFeedback.createdAt);
      nextAllowed.setDate(nextAllowed.getDate() + 7);
      return res.status(429).json({
        message: `You can submit feedback once per week. Next submission allowed on ${nextAllowed.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.`,
      });
    }

    console.log(`📝 Analyzing sentiment for feedback from ${employee.name}...`);
    let sentimentScore;
    try {
      sentimentScore = await analyzeSentiment(comment);
      console.log(`✅ Sentiment score: ${sentimentScore}`);
    } catch (err) {
      console.error("Sentiment analysis failed, using default:", err.message);
      sentimentScore = 0.5;
    }

    const feedbackData = {
      fromEmployee: employee.name,
      employeeId: employee._id,
      comment: comment.trim(),
      sentimentScore,
      managerId,
    };

    if (ratings) feedbackData.ratings = ratings;
    if (npsScore != null) feedbackData.npsScore = npsScore;
    if (feedbackCategory) feedbackData.feedbackCategory = feedbackCategory;
    if (feedbackType) feedbackData.feedbackType = feedbackType;
    if (pulseMood) feedbackData.pulseMood = pulseMood;
    if (oneOnOneFrequency) feedbackData.oneOnOneFrequency = oneOnOneFrequency;
    if (feedbackFrequency) feedbackData.feedbackFrequency = feedbackFrequency;
    if (concernResponseTime) feedbackData.concernResponseTime = concernResponseTime;
    if (peerComparison) feedbackData.peerComparison = peerComparison;
    if (timePeriod) feedbackData.timePeriod = timePeriod;
    if (willingToFollowUp != null) feedbackData.willingToFollowUp = willingToFollowUp;
    if (urgency) feedbackData.urgency = urgency;

    feedbackData.compositeFeedbackScore = computeCompositeFeedbackScore(feedbackData);
    console.log(`📊 Composite feedback score: ${feedbackData.compositeFeedbackScore}`);

    const feedback = await Feedback.create(feedbackData);

    res.status(201).json({
      message: "Feedback submitted successfully",
      feedback: {
        id: feedback._id,
        comment: feedback.comment,
        sentimentScore: feedback.sentimentScore,
        compositeFeedbackScore: feedback.compositeFeedbackScore,
        ratings: feedback.ratings,
        npsScore: feedback.npsScore,
        pulseMood: feedback.pulseMood,
        feedbackCategory: feedback.feedbackCategory,
        feedbackType: feedback.feedbackType,
        managerName: manager.name,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Feedback submit error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

// GET /api/feedback/my-feedbacks — paginated list of employee's own feedbacks
router.get("/my-feedbacks", authMiddleware, requireRole("employee"), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [feedbacks, total] = await Promise.all([
      Feedback.find({ employeeId: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Feedback.countDocuments({ employeeId: req.user.id }),
    ]);

    //attaching manager with his id
    const managerIds = [...new Set(feedbacks.map(f => f.managerId.toString()))];
    const managers = await User.find({ _id: { $in: managerIds } }).lean();
    const managerMap = {};
    managers.forEach(m => { managerMap[m._id.toString()] = m.name; });

    const result = feedbacks.map(f => ({
      ...f,
      managerName: managerMap[f.managerId.toString()] || "Unknown"
    }));

    res.json({
      feedbacks: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("My feedbacks error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/feedback — legacy create (for seed/admin)
router.post("/", async (req, res) => {
  try {
    const feedback = await Feedback.create(req.body);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/feedback/manager/:managerId 
router.get("/manager/:managerId", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [feedbacks, total] = await Promise.all([
      Feedback.find({ managerId: req.params.managerId })
        .select("-fromEmployee -employeeId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feedback.countDocuments({ managerId: req.params.managerId }),
    ]);

    res.json({
      feedbacks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch feedbacks" });
  }
});

module.exports = router;
