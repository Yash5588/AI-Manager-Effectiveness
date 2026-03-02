const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const User = require("../models/User");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { authMiddleware, requireRole } = require("../middleware/auth");
const { analyzeSentiment } = require("../services/aiSuggestionsService");

// Compute composite feedback score (returns 0-1)
function computeCompositeFeedbackScore(feedback) {
  let totalWeight = 0;
  let weightedSum = 0;

  // Text sentiment (weight: 0.30)
  if (feedback.sentimentScore != null) {
    weightedSum += feedback.sentimentScore * 0.30;
    totalWeight += 0.30;
  }

  // Structured ratings avg (weight: 0.25)
  if (feedback.ratings) {
    const ratingValues = Object.values(feedback.ratings).filter(v => v != null && v > 0);
    if (ratingValues.length > 0) {
      const avgRating = ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length;
      weightedSum += (avgRating - 1) / 4 * 0.25; // normalize 1-5 → 0-1
      totalWeight += 0.25;
    }
  }

  // NPS (weight: 0.15)
  if (feedback.npsScore != null) {
    weightedSum += (feedback.npsScore / 10) * 0.15;
    totalWeight += 0.15;
  }

  // Pulse mood (weight: 0.10)
  if (feedback.pulseMood) {
    const moodMap = { thriving: 1.0, happy: 0.75, neutral: 0.5, stressed: 0.25, struggling: 0.0 };
    weightedSum += (moodMap[feedback.pulseMood] ?? 0.5) * 0.10;
    totalWeight += 0.10;
  }

  // Behavioral frequencies (weight: 0.10)
  if (feedback.oneOnOneFrequency || feedback.feedbackFrequency || feedback.concernResponseTime) {
    const freqMap = { weekly: 1.0, biweekly: 0.75, monthly: 0.5, rarely: 0.25, never: 0.0, after_every_task: 1.0, same_day: 1.0, within_week: 0.75, within_month: 0.5 };
    const freqValues = [
      feedback.oneOnOneFrequency ? freqMap[feedback.oneOnOneFrequency] : null,
      feedback.feedbackFrequency ? freqMap[feedback.feedbackFrequency] : null,
      feedback.concernResponseTime ? freqMap[feedback.concernResponseTime] : null,
    ].filter(v => v != null);

    if (freqValues.length > 0) {
      const avgFreq = freqValues.reduce((s, v) => s + v, 0) / freqValues.length;
      weightedSum += avgFreq * 0.10;
      totalWeight += 0.10;
    }
  }

  // Peer comparison (weight: 0.10)
  if (feedback.peerComparison) {
    const peerMap = { much_better: 1.0, better: 0.75, same: 0.5, worse: 0.25, much_worse: 0.0 };
    weightedSum += (peerMap[feedback.peerComparison] ?? 0.5) * 0.10;
    totalWeight += 0.10;
  }

  // Normalize for missing signals
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

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

    // Lookup employee
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Verify manager exists
    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Rate limit: 1 feedback per employee per week
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

    // Calculate sentiment via AI
    console.log(`📝 Analyzing sentiment for feedback from ${employee.name}...`);
    let sentimentScore;
    try {
      sentimentScore = await analyzeSentiment(comment);
      console.log(`✅ Sentiment score: ${sentimentScore}`);
    } catch (err) {
      console.error("Sentiment analysis failed, using default:", err.message);
      sentimentScore = 0.5; // default neutral if AI fails
    }

    // Build feedback data
    const feedbackData = {
      fromEmployee: employee.name,
      employeeId: employee._id,
      comment: comment.trim(),
      sentimentScore,
      managerId,
    };

    // Add optional fields
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

    // Compute composite score
    feedbackData.compositeFeedbackScore = computeCompositeFeedbackScore(feedbackData);
    console.log(`📊 Composite feedback score: ${feedbackData.compositeFeedbackScore}`);

    // Save feedback
    const feedback = await Feedback.create(feedbackData);

    // Invalidate today's AI cache for this manager
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    await ScoreSnapshot.deleteOne({
      managerId,
      createdAt: { $gte: todayStart }
    });
    console.log(`♻️  Invalidated AI cache for manager ${managerId} due to new feedback.`);

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

    // Attach manager name to each feedback
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

// GET /api/feedback/manager/:managerId — anonymous, paginated
router.get("/manager/:managerId", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [feedbacks, total] = await Promise.all([
      Feedback.find({ managerId: req.params.managerId })
        .select("-fromEmployee -employeeId") // Strip employee identity
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
