const express = require("express");
const router = express.Router();
const ScoreSnapshot = require("../models/ScoreSnapshot");

// GET /api/score-snapshots/:managerId — monthly score history (latest snapshot per month)
router.get("/:managerId", async (req, res) => {
    try {
        const { managerId } = req.params;
        const months = parseInt(req.query.months) || 12;

        const since = new Date();
        since.setMonth(since.getMonth() - months);

        // Get latest snapshot per month (same pattern as latest feedback per employee)
        const mongoose = require("mongoose");
        const snapshots = await ScoreSnapshot.aggregate([
            { $match: { managerId: new mongoose.Types.ObjectId(managerId), createdAt: { $gte: since } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                    doc: { $first: "$$ROOT" },
                }
            },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { createdAt: 1 } },
        ]);

        res.json(snapshots);
    } catch (error) {
        console.error("Score snapshot fetch error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
