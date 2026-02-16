const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");

const { analyzeSentiment } = require("../services/aiSuggestionsService");

// CREATE feedback
router.post("/", async (req, res) => {
  try {
    const { comment } = req.body;

    // Calculate sentiment score from comment using LLM
    let sentimentScore = 0.5;
    if (comment) {
      sentimentScore = await analyzeSentiment(comment);
    }

    // Override/Set the sentiment score
    const feedbackData = {
      ...req.body,
      sentimentScore
    };

    const feedback = await Feedback.create(feedbackData);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET feedback by manager
router.get("/manager/:managerId", async (req, res) => {
  const feedbacks = await Feedback.find({
    managerId: req.params.managerId
  });
  res.json(feedbacks);
});

// ANALYZE sentiment (standalone)
router.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;
    const score = await analyzeSentiment(text || "");
    res.json({ sentimentScore: score });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// RECALCULATE sentiment for existing feedback
router.post("/:id/recalculate", async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    const score = await analyzeSentiment(feedback.comment);
    feedback.sentimentScore = score;
    await feedback.save();

    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
