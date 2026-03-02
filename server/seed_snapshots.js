const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");
const ScoreSnapshot = require("./models/ScoreSnapshot");

dotenv.config();

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function randomWalk(base, volatility, min = 0, max = 1) {
    return clamp(base + (Math.random() - 0.5) * volatility, min, max);
}

async function seedSnapshots() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        await ScoreSnapshot.deleteMany({});
        console.log("Cleared existing score snapshots.\n");

        const managers = await User.find({ userType: "manager" });
        if (managers.length === 0) {
            console.error("No managers found. Run seed_scenarios.js first.");
            process.exit(1);
        }

        const profiles = {
            Operations: {
                baseScore: 52,
                trend: 0.3,
                volatility: 6,
                breakdown: { emp: 0.5, fb: 0.48, met: 0.67 },
            },
            Sales: {
                baseScore: 25,
                trend: -0.1,
                volatility: 5,
                breakdown: { emp: 0.25, fb: 0.18, met: 0.32 },
            },
            Product: {
                baseScore: 88,
                trend: 0.15,
                volatility: 3,
                breakdown: { emp: 0.92, fb: 0.9, met: 0.97 },
            },
        };

        const MONTHS = 12;
        const now = new Date();

        for (const manager of managers) {
            const profile = profiles[manager.department] || profiles.Operations;
            const snapshots = [];

            let currentScore = profile.baseScore;
            let empScore = profile.breakdown.emp;
            let fbScore = profile.breakdown.fb;
            let metScore = profile.breakdown.met;

            for (let m = MONTHS; m >= 0; m--) {
                const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 12, 0, 0);

                empScore = randomWalk(empScore + profile.trend * 0.008, 0.06);
                fbScore = randomWalk(fbScore + profile.trend * 0.008, 0.07);
                metScore = randomWalk(metScore + profile.trend * 0.005, 0.05);

                const rawScore = empScore * 0.4 + fbScore * 0.3 + metScore * 0.3;
                currentScore = clamp(Math.round(rawScore * 100), 0, 100);

                const category =
                    currentScore >= 85
                        ? "Excellent"
                        : currentScore >= 70
                            ? "Good"
                            : currentScore >= 50
                                ? "Average"
                                : "Needs Improvement";

                snapshots.push({
                    managerId: manager._id,
                    finalScore: currentScore,
                    breakdown: {
                        avgEmployeeScore: Math.round(empScore * 100) / 100,
                        avgFeedbackScore: Math.round(fbScore * 100) / 100,
                        avgMetricScore: Math.round(metScore * 100) / 100,
                    },
                    category,
                    counts: {
                        employees: manager.department === "Sales" ? 3 : manager.department === "Product" ? 3 : 4,
                        feedbacks: manager.department === "Sales" ? 3 : manager.department === "Product" ? 3 : 4,
                        metrics: manager.department === "Product" ? 2 : 3,
                    },
                    createdAt: date,
                    updatedAt: date,
                });
            }

            await ScoreSnapshot.insertMany(snapshots);
            console.log(
                `📈 Seeded ${snapshots.length} monthly snapshots for ${manager.name} (${manager.department}) ` +
                `— score range: ${Math.min(...snapshots.map((s) => s.finalScore))} → ${Math.max(
                    ...snapshots.map((s) => s.finalScore)
                )}`
            );
        }

        console.log("\n✅ Monthly score snapshots seeded successfully!");
        process.exit();
    } catch (err) {
        console.error("Seed snapshots error:", err);
        process.exit(1);
    }
}

seedSnapshots();
