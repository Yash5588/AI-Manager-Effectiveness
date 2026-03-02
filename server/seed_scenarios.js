const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");
const Feedback = require("./models/Feedback");
const PerformanceMetric = require("./models/PerformanceMetric");
const ScoreSnapshot = require("./models/ScoreSnapshot");
const ManagerExtendedMetrics = require("./models/ManagerExtendedMetrics");

dotenv.config();

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
function randomWalk(base, volatility, min = 0, max = 1) {
    return clamp(base + (Math.random() - 0.5) * volatility, min, max);
}

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // Clear all data
        await Promise.all([
            User.deleteMany({}),
            Feedback.deleteMany({}),
            PerformanceMetric.deleteMany({}),
            ScoreSnapshot.deleteMany({}),
            ManagerExtendedMetrics.deleteMany({}),
        ]);
        console.log("Cleared all existing User data and feedback/metrics.\n");

        // === HR Users ===
        const hr1 = await User.create({
            name: "Priya Sharma",
            email: "priya.sharma@company.com",
            password: "password123",
            userType: "hr",
            department: "Human Resources",
            designation: "HR Director",
        });
        console.log(`✅ Created HR 1: ${hr1.name} (${hr1.email})`);

        const hr2 = await User.create({
            name: "Raj Patel",
            email: "raj.patel@company.com",
            password: "password123",
            userType: "hr",
            department: "Human Resources",
            designation: "HR Manager",
        });
        console.log(`✅ Created HR 2: ${hr2.name} (${hr2.email})\n`);

        // === HR 1's Managers ===

        // Manager 1: Neutral (Operations)
        const neutralManager = await User.create({
            name: "Jordan Lee",
            email: "jordan.lee@company.com",
            password: "password123",
            userType: "manager",
            department: "Operations",
            experienceYears: 5,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${neutralManager.name} → HR: ${hr1.name}`);

        const neutralEmployees = await Promise.all([
            User.create({ name: "Sam Wilson", email: "sam.wilson@company.com", password: "password123", userType: "employee", role: "Ops Specialist", performanceRating: 3, managerId: neutralManager._id }),
            User.create({ name: "Casey Smith", email: "casey.smith@company.com", password: "password123", userType: "employee", role: "Logistics", performanceRating: 4, managerId: neutralManager._id }),
            User.create({ name: "Jamie Doe", email: "jamie.doe@company.com", password: "password123", userType: "employee", role: "Coordinator", performanceRating: 2, managerId: neutralManager._id }),
            User.create({ name: "Taylor Brown", email: "taylor.brown@company.com", password: "password123", userType: "employee", role: "Analyst", performanceRating: 3, managerId: neutralManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Sam Wilson", employeeId: neutralEmployees[0]._id, comment: "Jordan is okay, but sometimes instructions are vague.", sentimentScore: 0.5, managerId: neutralManager._id, ratings: { communication: 3, recognition: 2, availability: 3, careerGrowth: 2, empowerment: 3, fairness: 3, decisionMaking: 3, conflictResolution: 3 }, npsScore: 5, feedbackCategory: "communication", feedbackType: "suggestion", pulseMood: "neutral", oneOnOneFrequency: "monthly", feedbackFrequency: "rarely", concernResponseTime: "within_week", peerComparison: "same", timePeriod: "last_month", urgency: "low", compositeFeedbackScore: 0.48 },
            { fromEmployee: "Casey Smith", employeeId: neutralEmployees[1]._id, comment: "Good weekly meetings, but we need more resources.", sentimentScore: 0.6, managerId: neutralManager._id, ratings: { communication: 4, recognition: 3, availability: 4, careerGrowth: 3, empowerment: 3, fairness: 4, decisionMaking: 3, conflictResolution: 3 }, npsScore: 6, feedbackCategory: "leadership", feedbackType: "suggestion", pulseMood: "happy", oneOnOneFrequency: "weekly", feedbackFrequency: "weekly", concernResponseTime: "within_week", peerComparison: "better", timePeriod: "last_month", urgency: "low", compositeFeedbackScore: 0.62 },
            { fromEmployee: "Jamie Doe", employeeId: neutralEmployees[2]._id, comment: "I feel like my career growth is stagnant here.", sentimentScore: 0.3, managerId: neutralManager._id, ratings: { communication: 2, recognition: 1, availability: 3, careerGrowth: 1, empowerment: 2, fairness: 3, decisionMaking: 2, conflictResolution: 2 }, npsScore: 3, feedbackCategory: "growth", feedbackType: "concern", pulseMood: "stressed", oneOnOneFrequency: "rarely", feedbackFrequency: "rarely", concernResponseTime: "within_month", peerComparison: "worse", timePeriod: "last_quarter", urgency: "high", willingToFollowUp: true, compositeFeedbackScore: 0.28 },
            { fromEmployee: "Taylor Brown", employeeId: neutralEmployees[3]._id, comment: "Standard management style. Nothing special but gets the job done.", sentimentScore: 0.5, managerId: neutralManager._id, ratings: { communication: 3, recognition: 3, availability: 3, careerGrowth: 3, empowerment: 3, fairness: 3, decisionMaking: 3, conflictResolution: 3 }, npsScore: 5, feedbackCategory: "leadership", feedbackType: "suggestion", pulseMood: "neutral", oneOnOneFrequency: "monthly", feedbackFrequency: "monthly", concernResponseTime: "within_week", peerComparison: "same", timePeriod: "overall", urgency: "low", compositeFeedbackScore: 0.50 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Project Completion Rate", value: 65, managerId: neutralManager._id },
            { metricName: "Team Efficiency", value: 55, managerId: neutralManager._id },
            { metricName: "Budget Adherence", value: 80, managerId: neutralManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: neutralManager._id,
            teamRetentionRate: 75,
            goalCompletionRate: 60,
            oneOnOneFrequency: 50,
            employeeGrowthRate: 40,
            responseTimeScore: 55,
            peerReviewScore: 58,
            projectDeliveryTimeliness: 65,
            employeeEngagementScore: 50,
            trainingInvestment: 35,
        });

        // Manager 2: Negative (Sales)
        const negativeManager = await User.create({
            name: "Alex Morgan",
            email: "alex.morgan@company.com",
            password: "password123",
            userType: "manager",
            department: "Sales",
            experienceYears: 8,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${negativeManager.name} → HR: ${hr1.name}`);

        const negativeEmployees = await Promise.all([
            User.create({ name: "Riley Green", email: "riley.green@company.com", password: "password123", userType: "employee", role: "Sales Rep", performanceRating: 2, managerId: negativeManager._id }),
            User.create({ name: "Morgan White", email: "morgan.white@company.com", password: "password123", userType: "employee", role: "Account Exec", performanceRating: 1, managerId: negativeManager._id }),
            User.create({ name: "Quinn Black", email: "quinn.black@company.com", password: "password123", userType: "employee", role: "SDR", performanceRating: 2, managerId: negativeManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Riley Green", employeeId: negativeEmployees[0]._id, comment: "Extremely micromanaged. Can't even talk to other departments without permission.", sentimentScore: 0.2, managerId: negativeManager._id, ratings: { communication: 1, recognition: 1, availability: 2, careerGrowth: 1, empowerment: 1, fairness: 2, decisionMaking: 2, conflictResolution: 1 }, npsScore: 1, feedbackCategory: "leadership", feedbackType: "concern", pulseMood: "stressed", urgency: "high", compositeFeedbackScore: 0.18 },
            { fromEmployee: "Morgan White", employeeId: negativeEmployees[1]._id, comment: "I am actively looking for a new job. The culture under Alex is toxic.", sentimentScore: 0.1, managerId: negativeManager._id, ratings: { communication: 1, recognition: 1, availability: 1, careerGrowth: 1, empowerment: 1, fairness: 1, decisionMaking: 1, conflictResolution: 1 }, npsScore: 0, feedbackCategory: "culture", feedbackType: "concern", pulseMood: "struggling", urgency: "high", willingToFollowUp: true, compositeFeedbackScore: 0.08 },
            { fromEmployee: "Quinn Black", employeeId: negativeEmployees[2]._id, comment: "Needs better empathy. Doesn't understand the challenges of the SDR role.", sentimentScore: 0.3, managerId: negativeManager._id, ratings: { communication: 2, recognition: 2, availability: 3, careerGrowth: 2, empowerment: 2, fairness: 3, decisionMaking: 2, conflictResolution: 2 }, npsScore: 3, feedbackCategory: "leadership", feedbackType: "suggestion", pulseMood: "neutral", urgency: "medium", compositeFeedbackScore: 0.35 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Sales Quota Mastery", value: 35, managerId: negativeManager._id },
            { metricName: "Pipeline Health", value: 42, managerId: negativeManager._id },
            { metricName: "Forecast Accuracy", value: 30, managerId: negativeManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: negativeManager._id,
            teamRetentionRate: 40,
            goalCompletionRate: 35,
            oneOnOneFrequency: 90, // Too frequent micromanagement
            employeeGrowthRate: 10,
            responseTimeScore: 40,
            peerReviewScore: 25,
            projectDeliveryTimeliness: 50,
            employeeEngagementScore: 15,
            trainingInvestment: 20,
        });

        // Manager 3: Positive (Product)
        const positiveManager = await User.create({
            name: "Sam Wilson",
            email: "sam.feedback@company.com",
            password: "password123",
            userType: "manager",
            department: "Product",
            experienceYears: 12,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${positiveManager.name} → HR: ${hr1.name}`);

        const positiveEmployees = await Promise.all([
            User.create({ name: "Bruce W.", email: "bruce.w@company.com", password: "password123", userType: "employee", role: "Product Designer", performanceRating: 5, managerId: positiveManager._id }),
            User.create({ name: "Clark K.", email: "clark.k@company.com", password: "password123", userType: "employee", role: "Product Manager", performanceRating: 5, managerId: positiveManager._id }),
            User.create({ name: "Barry A.", email: "barry.a@company.com", password: "password123", userType: "employee", role: "Researcher", performanceRating: 4, managerId: positiveManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Bruce W.", employeeId: positiveEmployees[0]._id, comment: "Sam is the best manager I've ever had. Inspiring and supportive.", sentimentScore: 0.95, managerId: positiveManager._id, ratings: { communication: 5, recognition: 5, availability: 5, careerGrowth: 5, empowerment: 5, fairness: 5, decisionMaking: 5, conflictResolution: 5 }, npsScore: 10, feedbackCategory: "leadership", feedbackType: "appreciation", pulseMood: "thriving", compositeFeedbackScore: 0.98 },
            { fromEmployee: "Clark K.", employeeId: positiveEmployees[1]._id, comment: "Visionary leadership. Sam manages to keep the team focused and happy.", sentimentScore: 0.9, managerId: positiveManager._id, ratings: { communication: 5, recognition: 5, availability: 4, careerGrowth: 5, empowerment: 5, fairness: 5, decisionMaking: 5, conflictResolution: 5 }, npsScore: 10, feedbackCategory: "leadership", feedbackType: "appreciation", pulseMood: "happy", compositeFeedbackScore: 0.94 },
            { fromEmployee: "Barry A.", employeeId: positiveEmployees[2]._id, comment: "Great mentorship. I've learned a lot in high-pressure situations.", sentimentScore: 0.85, managerId: positiveManager._id, ratings: { communication: 4, recognition: 5, availability: 5, careerGrowth: 4, empowerment: 5, fairness: 5, decisionMaking: 4, conflictResolution: 5 }, npsScore: 9, feedbackCategory: "growth", feedbackType: "appreciation", pulseMood: "thriving", compositeFeedbackScore: 0.89 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Feature Velocity", value: 95, managerId: positiveManager._id },
            { metricName: "Design System Adoption", value: 88, managerId: positiveManager._id },
            { metricName: "User CSAT", value: 92, managerId: positiveManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: positiveManager._id,
            teamRetentionRate: 100,
            goalCompletionRate: 98,
            oneOnOneFrequency: 85,
            employeeGrowthRate: 90,
            responseTimeScore: 92,
            peerReviewScore: 95,
            projectDeliveryTimeliness: 94,
            employeeEngagementScore: 98,
            trainingInvestment: 85,
        });

        // Add 3 Managers for HR 2
        console.log(`\n=== HR 2's Managers ===`);

        // Eng Manager
        const engManager = await User.create({
            name: "Ananya Rao",
            email: "ananya.rao@company.com",
            password: "password123",
            userType: "manager",
            department: "Engineering",
            experienceYears: 10,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${engManager.name} → HR: ${hr2.name}`);

        const engEmployees = await Promise.all([
            User.create({ name: "Aman Gupta", email: "aman.gupta@company.com", password: "password123", userType: "employee", role: "Senior Developer", performanceRating: 5, managerId: engManager._id }),
            User.create({ name: "Karthik Nair", email: "karthik.nair@company.com", password: "password123", userType: "employee", role: "DevOps Engineer", performanceRating: 4, managerId: engManager._id }),
            User.create({ name: "Meera Iyer", email: "meera.iyer@company.com", password: "password123", userType: "employee", role: "Frontend Developer", performanceRating: 4, managerId: engManager._id }),
            User.create({ name: "Rohan Joshi", email: "rohan.joshi@company.com", password: "password123", userType: "employee", role: "QA Engineer", performanceRating: 3, managerId: engManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Aman Gupta", employeeId: engEmployees[0]._id, comment: "Technical expertise is great, but could improve delegation.", sentimentScore: 0.6, managerId: engManager._id, ratings: { communication: 4, recognition: 3, availability: 3, careerGrowth: 4, empowerment: 2, fairness: 5, decisionMaking: 4, conflictResolution: 3 }, npsScore: 7, feedbackCategory: "technical", feedbackType: "suggestion", pulseMood: "happy", compositeFeedbackScore: 0.60 },
            { fromEmployee: "Meera Iyer", employeeId: engEmployees[2]._id, comment: "Encourages code quality over rushing. Very appreciated.", sentimentScore: 0.8, managerId: engManager._id, ratings: { communication: 5, recognition: 4, availability: 4, careerGrowth: 4, empowerment: 4, fairness: 5, decisionMaking: 5, conflictResolution: 4 }, npsScore: 9, feedbackCategory: "technical", feedbackType: "appreciation", pulseMood: "thriving", compositeFeedbackScore: 0.82 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Code Quality Index", value: 85, managerId: engManager._id },
            { metricName: "Deployment Frequency", value: 70, managerId: engManager._id },
            { metricName: "MTTR", value: 90, managerId: engManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: engManager._id,
            teamRetentionRate: 90,
            goalCompletionRate: 85,
            oneOnOneFrequency: 60,
            employeeGrowthRate: 75,
            responseTimeScore: 80,
            peerReviewScore: 78,
            projectDeliveryTimeliness: 85,
            employeeEngagementScore: 88,
            trainingInvestment: 95,
        });

        // Mkt Manager
        const mktManager = await User.create({
            name: "Arjun Mehta",
            email: "arjun.mehta@company.com",
            password: "password123",
            userType: "manager",
            department: "Marketing",
            experienceYears: 6,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${mktManager.name} → HR: ${hr2.name}`);

        const mktEmployees = await Promise.all([
            User.create({ name: "Divya Pillai", email: "divya.pillai@company.com", password: "password123", userType: "employee", role: "Content Strategist", performanceRating: 4, managerId: mktManager._id }),
            User.create({ name: "Nikhil Sen", email: "nikhil.sen@company.com", password: "password123", userType: "employee", role: "Social Media Manager", 性能Rating: 3, managerId: mktManager._id }),
            User.create({ name: "Sita Sharma", email: "sita.sharma@company.com", password: "password123", userType: "employee", role: "SEO Specialist", performanceRating: 2, managerId: mktManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Divya Pillai", employeeId: mktEmployees[0]._id, comment: "Creative freedom is great. Arjun trusts us a lot.", sentimentScore: 0.9, managerId: mktManager._id, ratings: { communication: 4, recognition: 5, availability: 5, careerGrowth: 4, empowerment: 5, fairness: 4, decisionMaking: 4, conflictResolution: 4 }, npsScore: 10, feedbackCategory: "culture", feedbackType: "appreciation", pulseMood: "happy", compositeFeedbackScore: 0.88 },
            { fromEmployee: "Sita Sharma", employeeId: mktEmployees[2]._id, comment: "Need more budget for high-impact campaigns.", sentimentScore: 0.5, managerId: mktManager._id, ratings: { communication: 3, recognition: 3, availability: 4, careerGrowth: 3, empowerment: 3, fairness: 4, decisionMaking: 2, conflictResolution: 3 }, npsScore: 6, feedbackCategory: "other", feedbackType: "suggestion", pulseMood: "neutral", compositeFeedbackScore: 0.52 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Lead Gen Targeting", value: 75, managerId: mktManager._id },
            { metricName: "Brand Engagement", value: 82, managerId: mktManager._id },
            { metricName: "CAC Optimization", value: 65, managerId: mktManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: mktManager._id,
            teamRetentionRate: 85,
            goalCompletionRate: 80,
            oneOnOneFrequency: 45,
            employeeGrowthRate: 60,
            responseTimeScore: 70,
            peerReviewScore: 75,
            projectDeliveryTimeliness: 70,
            employeeEngagementScore: 82,
            trainingInvestment: 50,
        });

        // CS Manager
        const csManager = await User.create({
            name: "Pooja Reddy",
            email: "pooja.reddy@company.com",
            password: "password123",
            userType: "manager",
            department: "Customer Success",
            experienceYears: 4,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${csManager.name} → HR: ${hr2.name}`);

        const csEmployees = await Promise.all([
            User.create({ name: "Sanjay Kumar", email: "sanjay.kumar@company.com", password: "password123", userType: "employee", role: "Support Lead", performanceRating: 3, managerId: csManager._id }),
            User.create({ name: "Lakshmi Bhat", email: "lakshmi.bhat@company.com", password: "password123", userType: "employee", role: "Support Agent", performanceRating: 2, managerId: csManager._id }),
            User.create({ name: "Farhan Ali", email: "farhan.ali@company.com", password: "password123", userType: "employee", role: "Support Agent", performanceRating: 1, managerId: csManager._id }),
            User.create({ name: "Zoya Khan", email: "zoya.khan@company.com", password: "password123", userType: "employee", role: "Escalation Specialist", performanceRating: 2, managerId: csManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Farhan Ali", employeeId: csEmployees[2]._id, comment: "I feel overworked. No support during peak hours.", sentimentScore: 0.2, managerId: csManager._id, ratings: { communication: 2, recognition: 1, availability: 1, careerGrowth: 1, empowerment: 1, fairness: 2, decisionMaking: 3, conflictResolution: 2 }, npsScore: 1, feedbackCategory: "worklife", feedbackType: "concern", pulseMood: "stressed", urgency: "high", compositeFeedbackScore: 0.22 },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Ticket Resolution Time", value: 45, managerId: csManager._id },
            { metricName: "Churn Prevention", value: 50, managerId: csManager._id },
            { metricName: "Support CSAT", value: 40, managerId: csManager._id },
        ]);

        await ManagerExtendedMetrics.create({
            managerId: csManager._id,
            teamRetentionRate: 65,
            goalCompletionRate: 55,
            oneOnOneFrequency: 30,
            employeeGrowthRate: 25,
            responseTimeScore: 40,
            peerReviewScore: 42,
            projectDeliveryTimeliness: 50,
            employeeEngagementScore: 45,
            trainingInvestment: 15,
        });

        const allManagers = [neutralManager, negativeManager, positiveManager, engManager, mktManager, csManager];
        const now = new Date();
        for (const mgr of allManagers) {
            console.log(`\nGenerating monthly historical snapshots for: ${mgr.name}...`);
            const snapshots = [];
            const baseEffectiveness = mgr.effectivenessScore || (mgr === positiveManager ? 0.9 : mgr === negativeManager ? 0.25 : 0.6);
            const baseFeedback = mgr === positiveManager ? 0.95 : mgr === negativeManager ? 0.2 : 0.55;
            const baseEmployee = mgr === positiveManager ? 0.98 : mgr === negativeManager ? 0.15 : 0.6;
            const baseMetric = mgr === positiveManager ? 0.92 : mgr === negativeManager ? 0.35 : 0.7;

            for (let m = 12; m >= 0; m--) {
                const date = new Date(now.getFullYear(), now.getMonth() - m, 1, 12, 0, 0);

                const effectiveness = Math.round(randomWalk(baseEffectiveness, 0.07) * 100);
                const feedbackValue = randomWalk(baseFeedback, 0.1);
                const employeeValue = randomWalk(baseEmployee, 0.06);
                const metricValue = randomWalk(baseMetric, 0.12);

                snapshots.push({
                    managerId: mgr._id,
                    finalScore: effectiveness,
                    breakdown: {
                        avgEmployeeScore: employeeValue,
                        avgFeedbackScore: feedbackValue,
                        avgMetricScore: metricValue,
                    },
                    category: effectiveness >= 85 ? "Excellent" : effectiveness >= 70 ? "Good" : effectiveness >= 50 ? "Average" : "Needs Improvement",
                    counts: {
                        employees: 4,
                        feedbacks: 12,
                        metrics: 3,
                    },
                    aiScore: effectiveness,
                    aiBreakdown: {
                        leadershipClarity: Math.round(randomWalk(effectiveness / 100, 0.1) * 100),
                        teamSentiment: Math.round(feedbackValue * 100),
                        operationalEfficiency: Math.round(metricValue * 100),
                        employeeGrowth: Math.round(employeeValue * 100),
                    },
                    createdAt: date,
                });
            }
            await ScoreSnapshot.insertMany(snapshots);
        }

        console.log("\n🚀 DB Successfully Seeded with Unified User Model!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedData();
