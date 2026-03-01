const express = require("express");
const router = express.Router();
const ScoreSnapshot = require("../models/ScoreSnapshot");

// GET /api/score-snapshots/:managerId — score history (query: days, default 90)
router.get("/:managerId", async (req, res) => {
    try {
        const { managerId } = req.params;
        const days = parseInt(req.query.days) || 90;

        const since = new Date();
        since.setDate(since.getDate() - days);

        const snapshots = await ScoreSnapshot.find({
            managerId,
            createdAt: { $gte: since },
        }).sort({ createdAt: 1 });

        res.json(snapshots);
    } catch (error) {
        console.error("Score snapshot fetch error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
