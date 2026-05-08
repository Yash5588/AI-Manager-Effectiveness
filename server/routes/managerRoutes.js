const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/", async (req, res) => {
  try {
    const manager = await User.create({ ...req.body, userType: "manager" });
    res.json(manager);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create manager" });
  }
});

router.get("/", async (req, res) => {
  try {
    const managers = await User.find({ userType: "manager" });
    res.json(managers);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to fetch managers" });
  }
});

module.exports = router;
