const express = require("express");
const router = express.Router();
const Manager = require("../models/Manager");

// CREATE manager
router.post("/", async (req, res) => {
  const manager = await Manager.create(req.body);
  res.json(manager);
});

// GET all managers
router.get("/", async (req, res) => {
  const managers = await Manager.find();
  res.json(managers);
});

module.exports = router;
