// Seed historical score snapshots for all managers
// Run AFTER seed_scenarios.js: node server/seed_snapshots.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Manager = require("./models/Manager");
const ScoreSnapshot = require("./models/ScoreSnapshot");

dotenv.config();

// Clamp value between min and max
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// Random walk around a base value
function randomWalk(base, volatility, min = 0, max = 1) {
    return clamp(base + (Math.random() - 0.5) * volatility, min, max);
}

async function seedSnapshots() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // Clear existing snapshots
        await ScoreSnapshot.deleteMany({});
        console.log("Cleared existing score snapshots.\n");

        const managers = await Manager.find();
        if (managers.length === 0) {
            console.error("No managers found. Run seed_scenarios.js first.");
            process.exit(1);
        }

        // Profile config per department
        const profiles = {
            Operations: {
                baseScore: 52,
                trend: 0.3,
                volatility: 4,
                breakdown: { emp: 0.5, fb: 0.48, met: 0.67 },
            },
            Sales: {
                baseScore: 25,
                trend: -0.1,
                volatility: 3,
                breakdown: { emp: 0.25, fb: 0.18, met: 0.32 },
            },
            Product: {
                baseScore: 88,
                trend: 0.15,
                volatility: 2,
                breakdown: { emp: 0.92, fb: 0.9, met: 0.97 },
            },
        };

        const DAYS = 30;
        const now = new Date();

        for (const manager of managers) {
            const profile = profiles[manager.department] || profiles.Operations;
            const snapshots = [];

            let currentScore = profile.baseScore;
            let empScore = profile.breakdown.emp;
            let fbScore = profile.breakdown.fb;
            let metScore = profile.breakdown.met;

            for (let d = DAYS; d >= 0; d--) {
                const date = new Date(now);
                date.setDate(date.getDate() - d);
                // Random hour during workday
                date.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

                // Evolve scores with random walk
                empScore = randomWalk(empScore + profile.trend * 0.002, 0.04);
                fbScore = randomWalk(fbScore + profile.trend * 0.002, 0.05);
                metScore = randomWalk(metScore + profile.trend * 0.001, 0.03);

                // Compute final score
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
                `📈 Seeded ${snapshots.length} snapshots for ${manager.name} (${manager.department}) ` +
                `— score range: ${Math.min(...snapshots.map((s) => s.finalScore))} → ${Math.max(
                    ...snapshots.map((s) => s.finalScore)
                )}`
            );
        }

        console.log("\n✅ Historical score snapshots seeded successfully!");
        process.exit();
    } catch (err) {
        console.error("Seed snapshots error:", err);
        process.exit(1);
    }
}

seedSnapshots();
