const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Manager = require("./models/Manager");
const Employee = require("./models/Employee");
const Feedback = require("./models/Feedback");
const PerformanceMetric = require("./models/PerformanceMetric");

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        // ==========================================
        // 1. NEUTRAL MANAGER SCENARIO
        // ==========================================
        const neutralEmail = "jordan.lee@company.com";
        const existingNeutral = await Manager.findOne({ email: neutralEmail });
        if (existingNeutral) {
            await Promise.all([
                Manager.deleteOne({ _id: existingNeutral._id }),
                Employee.deleteMany({ managerId: existingNeutral._id }),
                Feedback.deleteMany({ managerId: existingNeutral._id }),
                PerformanceMetric.deleteMany({ managerId: existingNeutral._id }),
            ]);
            console.log("Cleaned up existing Neutral Manager");
        }

        const neutralManager = await Manager.create({
            name: "Jordan Lee",
            email: neutralEmail,
            department: "Operations",
            experienceYears: 5,
        });
        console.log(`Created Neutral Manager: ${neutralManager.name}`);

        const neutralEmployees = await Employee.insertMany([
            { name: "Sam Wilson", role: "Ops Specialist", performanceRating: 3, managerId: neutralManager._id },
            { name: "Casey Smith", role: "Logistics", performanceRating: 4, managerId: neutralManager._id },
            { name: "Jamie Doe", role: "Coordinator", performanceRating: 2, managerId: neutralManager._id },
            { name: "Taylor Brown", role: "Analyst", performanceRating: 3, managerId: neutralManager._id },
        ]);
        console.log(`Added ${neutralEmployees.length} employees for ${neutralManager.name}`);

        await Feedback.insertMany([
            {
                fromEmployee: "Sam Wilson",
                comment: "Jordan is okay, but sometimes instructions are vague.",
                sentimentScore: 0.5,
                managerId: neutralManager._id,
            },
            {
                fromEmployee: "Casey Smith",
                comment: "Good weekly meetings, but we need more resources.",
                sentimentScore: 0.6,
                managerId: neutralManager._id,
            },
            {
                fromEmployee: "Jamie Doe",
                comment: "I feel like my career growth is stagnant here.",
                sentimentScore: 0.3,
                managerId: neutralManager._id,
            },
            {
                fromEmployee: "Taylor Brown",
                comment: "Standard management style. Nothing special but gets the job done.",
                sentimentScore: 0.5,
                managerId: neutralManager._id,
            },
        ]);
        console.log(`Added feedback for ${neutralManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Project Completion Rate", value: 65, managerId: neutralManager._id },
            { metricName: "Team Efficiency", value: 55, managerId: neutralManager._id },
            { metricName: "Budget Adherence", value: 80, managerId: neutralManager._id },
        ]);
        console.log(`Added metrics for ${neutralManager.name}`);


        // ==========================================
        // 2. NEGATIVE MANAGER SCENARIO
        // ==========================================
        const negativeEmail = "alex.morgan@company.com";
        const existingNegative = await Manager.findOne({ email: negativeEmail });
        if (existingNegative) {
            await Promise.all([
                Manager.deleteOne({ _id: existingNegative._id }),
                Employee.deleteMany({ managerId: existingNegative._id }),
                Feedback.deleteMany({ managerId: existingNegative._id }),
                PerformanceMetric.deleteMany({ managerId: existingNegative._id }),
            ]);
            console.log("Cleaned up existing Negative Manager");
        }

        const negativeManager = await Manager.create({
            name: "Alex Morgan",
            email: negativeEmail,
            department: "Sales",
            experienceYears: 8,
        });
        console.log(`\nCreated Negative Manager: ${negativeManager.name}`);

        const negativeEmployees = await Employee.insertMany([
            { name: "Riley Green", role: "Sales Rep", performanceRating: 2, managerId: negativeManager._id },
            { name: "Morgan White", role: "Account Exec", performanceRating: 1, managerId: negativeManager._id },
            { name: "Quinn Black", role: "SDR", performanceRating: 2, managerId: negativeManager._id },
        ]);
        console.log(`Added ${negativeEmployees.length} employees for ${negativeManager.name}`);

        await Feedback.insertMany([
            {
                fromEmployee: "Riley Green",
                comment: "Alex is very micromanaging and doesn't trust us.",
                sentimentScore: 0.2,
                managerId: negativeManager._id,
            },
            {
                fromEmployee: "Morgan White",
                comment: "The pressure is too high and expectations are unrealistic. I am burnt out.",
                sentimentScore: 0.1,
                managerId: negativeManager._id,
            },
            {
                fromEmployee: "Quinn Black",
                comment: "Rarely available for support. I feel lost in my role.",
                sentimentScore: 0.25,
                managerId: negativeManager._id,
            },
        ]);
        console.log(`Added feedback for ${negativeManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Sales Quota Attainment", value: 35, managerId: negativeManager._id },
            { metricName: "Client Retention", value: 40, managerId: negativeManager._id },
            { metricName: "Team Morale Survey", value: 20, managerId: negativeManager._id },
        ]);
        console.log(`Added metrics for ${negativeManager.name}`);


        // ==========================================
        // 3. POSITIVE MANAGER SCENARIO
        // ==========================================
        const positiveEmail = "diana.prince@company.com";
        const existingPositive = await Manager.findOne({ email: positiveEmail });
        if (existingPositive) {
            await Promise.all([
                Manager.deleteOne({ _id: existingPositive._id }),
                Employee.deleteMany({ managerId: existingPositive._id }),
                Feedback.deleteMany({ managerId: existingPositive._id }),
                PerformanceMetric.deleteMany({ managerId: existingPositive._id }),
            ]);
            console.log("Cleaned up existing Positive Manager");
        }

        const positiveManager = await Manager.create({
            name: "Diana Prince",
            email: positiveEmail,
            department: "Product",
            experienceYears: 12,
        });
        console.log(`\nCreated Positive Manager: ${positiveManager.name}`);

        const positiveEmployees = await Employee.insertMany([
            { name: "Bruce W.", role: "Product Designer", performanceRating: 5, managerId: positiveManager._id },
            { name: "Clark K.", role: "Product Manager", performanceRating: 5, managerId: positiveManager._id },
            { name: "Barry A.", role: "Researcher", performanceRating: 4, managerId: positiveManager._id },
        ]);
        console.log(`Added ${positiveEmployees.length} employees for ${positiveManager.name}`);

        await Feedback.insertMany([
            {
                fromEmployee: "Bruce W.",
                comment: "Diana is an inspiring leader who empowers the team.",
                sentimentScore: 0.95,
                managerId: positiveManager._id,
            },
            {
                fromEmployee: "Clark K.",
                comment: "Excellent strategic vision and very supportive of personal growth.",
                sentimentScore: 0.9,
                managerId: positiveManager._id,
            },
            {
                fromEmployee: "Barry A.",
                comment: "Creates a great work environment. Always open to new ideas.",
                sentimentScore: 0.85,
                managerId: positiveManager._id,
            },
        ]);
        console.log(`Added feedback for ${positiveManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Product Launch Success", value: 98, managerId: positiveManager._id },
            { metricName: "Team Velocity", value: 95, managerId: positiveManager._id },
        ]);
        console.log(`Added metrics for ${positiveManager.name}`);


        console.log("\n✅ Done seeding!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
