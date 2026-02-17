const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");


// CREATE feedback
router.post("/", async (req, res) => {
  try {
    const feedback = await Feedback.create(req.body);
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


module.exports = router;
