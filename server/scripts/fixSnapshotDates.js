// Script to redistribute existing snapshots to weekly intervals and add more
// Run: node scripts/fixSnapshotDates.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const ScoreSnapshot = require("../models/ScoreSnapshot");
const User = require("../models/User");

async function fixSnapshotDates() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all managers
    const managers = await User.find({ userType: "manager" });
    console.log(`Found ${managers.length} manager(s)`);

    for (const mgr of managers) {
        const snapshots = await ScoreSnapshot.find({ managerId: mgr._id }).sort({ createdAt: 1 });
        console.log(`\n${mgr.name}: ${snapshots.length} existing snapshot(s)`);

        if (snapshots.length === 0) {
            console.log("  No snapshots to adjust, generating weekly snapshots...");

            // Create 12 weekly snapshots with slightly varying scores
            const baseScore = 65 + Math.floor(Math.random() * 20); // 65-85
            for (let week = 11; week >= 0; week--) {
                const date = new Date();
                date.setDate(date.getDate() - (week * 7));
                date.setHours(2, 0, 0, 0); // 2 AM IST like the cron

                // Score fluctuates ±5 from base, trending upward
                const trend = Math.round((11 - week) * 0.8); // gradual improvement
                const noise = Math.floor(Math.random() * 7) - 3; // ±3
                const score = Math.max(30, Math.min(100, baseScore + trend + noise));

                const category = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Average" : "Needs Improvement";

                await ScoreSnapshot.create({
                    managerId: mgr._id,
                    finalScore: score,
                    breakdown: {
                        avgEmployeeScore: Math.round((0.4 + Math.random() * 0.4) * 100) / 100,
                        avgFeedbackScore: Math.round((0.4 + Math.random() * 0.4) * 100) / 100,
                        avgMetricScore: Math.round((0.4 + Math.random() * 0.4) * 100) / 100,
                    },
                    category,
                    counts: { employees: 3 + Math.floor(Math.random() * 5), feedbacks: 5 + Math.floor(Math.random() * 10), metrics: 3 },
                    aiScore: score,
                    createdAt: date,
                    updatedAt: date,
                });
            }
            console.log("  ✓ Created 12 weekly snapshots");
            continue;
        }

        // Redistribute existing snapshots to weekly intervals
        // Keep the scores but space them out evenly across past weeks
        const totalWeeks = Math.max(snapshots.length, 12);

        for (let i = 0; i < snapshots.length; i++) {
            const weeksAgo = totalWeeks - 1 - i;
            const newDate = new Date();
            newDate.setDate(newDate.getDate() - (weeksAgo * 7));
            newDate.setHours(2, 0, 0, 0); // 2 AM IST

            await ScoreSnapshot.updateOne(
                { _id: snapshots[i]._id },
                { $set: { createdAt: newDate, updatedAt: newDate } }
            );
            console.log(`  ✓ Snapshot ${i + 1}/${snapshots.length}: moved to ${newDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`);
        }

        // If fewer than 12 snapshots exist, generate additional ones to fill gaps
        if (snapshots.length < 12) {
            const neededWeeks = 12 - snapshots.length;
            const existingScores = snapshots.map(s => s.finalScore || s.aiScore || 65);
            const avgScore = Math.round(existingScores.reduce((s, v) => s + v, 0) / existingScores.length);

            console.log(`  Adding ${neededWeeks} more snapshots (avg score: ${avgScore})...`);

            // Use the earliest snapshot as a template
            const template = snapshots[0];

            for (let w = 0; w < neededWeeks; w++) {
                const weeksAgo = totalWeeks - 1 - w; // fill the earliest weeks
                // Check if this week already has a snapshot (from the redistribution above)
                if (w < neededWeeks) {
                    const date = new Date();
                    date.setDate(date.getDate() - ((totalWeeks - 1 - w) * 7));
                    date.setHours(2, 0, 0, 0);

                    // Score slightly lower than average (older = slightly lower)
                    const olderPenalty = Math.round((neededWeeks - w) * 0.7);
                    const noise = Math.floor(Math.random() * 5) - 2;
                    const score = Math.max(30, Math.min(100, avgScore - olderPenalty + noise));
                    const category = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Average" : "Needs Improvement";

                    await ScoreSnapshot.create({
                        managerId: mgr._id,
                        finalScore: score,
                        breakdown: template.breakdown || {
                            avgEmployeeScore: 0.6,
                            avgFeedbackScore: 0.55,
                            avgMetricScore: 0.65,
                        },
                        category,
                        counts: template.counts || { employees: 4, feedbacks: 8, metrics: 3 },
                        aiScore: score,
                        createdAt: date,
                        updatedAt: date,
                    });
                }
            }
            console.log(`  ✓ Added ${neededWeeks} historical snapshots`);
        }
    }

    // Final summary
    console.log("\n── Summary ──");
    for (const mgr of managers) {
        const count = await ScoreSnapshot.countDocuments({ managerId: mgr._id });
        const latest = await ScoreSnapshot.findOne({ managerId: mgr._id }).sort({ createdAt: -1 });
        const earliest = await ScoreSnapshot.findOne({ managerId: mgr._id }).sort({ createdAt: 1 });
        console.log(`${mgr.name}: ${count} snapshots (${earliest?.createdAt?.toLocaleDateString()} → ${latest?.createdAt?.toLocaleDateString()})`);
    }

    await mongoose.disconnect();
    console.log("\nDone!");
}

fixSnapshotDates().catch(err => {
    console.error("Script failed:", err);
    process.exit(1);
});
