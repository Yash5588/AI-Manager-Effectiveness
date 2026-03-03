const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/", async (req, res) => {
  const manager = await User.create({ ...req.body, userType: "manager" });
  res.json(manager);
});

router.get("/", async (req, res) => {
  const managers = await User.find({ userType: "manager" });
  res.json(managers);
});

module.exports = router;
