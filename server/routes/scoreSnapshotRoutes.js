const express = require("express");
const router = express.Router();
const ScoreSnapshot = require("../models/ScoreSnapshot");

// GET /api/score-snapshots/:managerId — score history (query: months, default 12)
router.get("/:managerId", async (req, res) => {
    try {
        const { managerId } = req.params;
        const months = parseInt(req.query.months) || 12;

        const since = new Date();
        since.setMonth(since.getMonth() - months);

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
