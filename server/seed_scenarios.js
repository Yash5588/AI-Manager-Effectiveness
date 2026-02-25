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

        // Clear all existing data
        await Promise.all([
            Manager.deleteMany({}),
            Employee.deleteMany({}),
            Feedback.deleteMany({}),
            PerformanceMetric.deleteMany({}),
        ]);
        console.log("Cleared all existing data.\n");

        // ==========================================
        // 1. NEUTRAL MANAGER SCENARIO
        // ==========================================
        const neutralManager = await Manager.create({
            name: "Jordan Lee",
            email: "jordan.lee@company.com",
            password: "password123",
            department: "Operations",
            experienceYears: 5,
        });
        console.log(`Created Neutral Manager: ${neutralManager.name} (${neutralManager.email})`);

        const neutralEmployees = await Promise.all([
            Employee.create({ name: "Sam Wilson", email: "sam.wilson@company.com", password: "password123", role: "Ops Specialist", performanceRating: 3, managerId: neutralManager._id }),
            Employee.create({ name: "Casey Smith", email: "casey.smith@company.com", password: "password123", role: "Logistics", performanceRating: 4, managerId: neutralManager._id }),
            Employee.create({ name: "Jamie Doe", email: "jamie.doe@company.com", password: "password123", role: "Coordinator", performanceRating: 2, managerId: neutralManager._id }),
            Employee.create({ name: "Taylor Brown", email: "taylor.brown@company.com", password: "password123", role: "Analyst", performanceRating: 3, managerId: neutralManager._id }),
        ]);
        console.log(`Added ${neutralEmployees.length} employees for ${neutralManager.name}`);

        await Feedback.insertMany([
            { fromEmployee: "Sam Wilson", employeeId: neutralEmployees[0]._id, comment: "Jordan is okay, but sometimes instructions are vague.", sentimentScore: 0.5, managerId: neutralManager._id },
            { fromEmployee: "Casey Smith", employeeId: neutralEmployees[1]._id, comment: "Good weekly meetings, but we need more resources.", sentimentScore: 0.6, managerId: neutralManager._id },
            { fromEmployee: "Jamie Doe", employeeId: neutralEmployees[2]._id, comment: "I feel like my career growth is stagnant here.", sentimentScore: 0.3, managerId: neutralManager._id },
            { fromEmployee: "Taylor Brown", employeeId: neutralEmployees[3]._id, comment: "Standard management style. Nothing special but gets the job done.", sentimentScore: 0.5, managerId: neutralManager._id },
        ]);
        console.log(`Added feedback for ${neutralManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Project Completion Rate", value: 65, managerId: neutralManager._id },
            { metricName: "Team Efficiency", value: 55, managerId: neutralManager._id },
            { metricName: "Budget Adherence", value: 80, managerId: neutralManager._id },
        ]);
        console.log(`Added metrics for ${neutralManager.name}\n`);


        // ==========================================
        // 2. NEGATIVE MANAGER SCENARIO
        // ==========================================
        const negativeManager = await Manager.create({
            name: "Alex Morgan",
            email: "alex.morgan@company.com",
            password: "password123",
            department: "Sales",
            experienceYears: 8,
        });
        console.log(`Created Negative Manager: ${negativeManager.name} (${negativeManager.email})`);

        const negativeEmployees = await Promise.all([
            Employee.create({ name: "Riley Green", email: "riley.green@company.com", password: "password123", role: "Sales Rep", performanceRating: 2, managerId: negativeManager._id }),
            Employee.create({ name: "Morgan White", email: "morgan.white@company.com", password: "password123", role: "Account Exec", performanceRating: 1, managerId: negativeManager._id }),
            Employee.create({ name: "Quinn Black", email: "quinn.black@company.com", password: "password123", role: "SDR", performanceRating: 2, managerId: negativeManager._id }),
        ]);
        console.log(`Added ${negativeEmployees.length} employees for ${negativeManager.name}`);

        await Feedback.insertMany([
            { fromEmployee: "Riley Green", employeeId: negativeEmployees[0]._id, comment: "Alex is very micromanaging and doesn't trust us.", sentimentScore: 0.2, managerId: negativeManager._id },
            { fromEmployee: "Morgan White", employeeId: negativeEmployees[1]._id, comment: "The pressure is too high and expectations are unrealistic. I am burnt out.", sentimentScore: 0.1, managerId: negativeManager._id },
            { fromEmployee: "Quinn Black", employeeId: negativeEmployees[2]._id, comment: "Rarely available for support. I feel lost in my role.", sentimentScore: 0.25, managerId: negativeManager._id },
        ]);
        console.log(`Added feedback for ${negativeManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Sales Quota Attainment", value: 35, managerId: negativeManager._id },
            { metricName: "Client Retention", value: 40, managerId: negativeManager._id },
            { metricName: "Team Morale Survey", value: 20, managerId: negativeManager._id },
        ]);
        console.log(`Added metrics for ${negativeManager.name}\n`);


        // ==========================================
        // 3. POSITIVE MANAGER SCENARIO
        // ==========================================
        const positiveManager = await Manager.create({
            name: "Diana Prince",
            email: "diana.prince@company.com",
            password: "password123",
            department: "Product",
            experienceYears: 12,
        });
        console.log(`Created Positive Manager: ${positiveManager.name} (${positiveManager.email})`);

        const positiveEmployees = await Promise.all([
            Employee.create({ name: "Bruce W.", email: "bruce.w@company.com", password: "password123", role: "Product Designer", performanceRating: 5, managerId: positiveManager._id }),
            Employee.create({ name: "Clark K.", email: "clark.k@company.com", password: "password123", role: "Product Manager", performanceRating: 5, managerId: positiveManager._id }),
            Employee.create({ name: "Barry A.", email: "barry.a@company.com", password: "password123", role: "Researcher", performanceRating: 4, managerId: positiveManager._id }),
        ]);
        console.log(`Added ${positiveEmployees.length} employees for ${positiveManager.name}`);

        await Feedback.insertMany([
            { fromEmployee: "Bruce W.", employeeId: positiveEmployees[0]._id, comment: "Diana is an inspiring leader who empowers the team.", sentimentScore: 0.95, managerId: positiveManager._id },
            { fromEmployee: "Clark K.", employeeId: positiveEmployees[1]._id, comment: "Excellent strategic vision and very supportive of personal growth.", sentimentScore: 0.9, managerId: positiveManager._id },
            { fromEmployee: "Barry A.", employeeId: positiveEmployees[2]._id, comment: "Creates a great work environment. Always open to new ideas.", sentimentScore: 0.85, managerId: positiveManager._id },
        ]);
        console.log(`Added feedback for ${positiveManager.name}`);

        await PerformanceMetric.insertMany([
            { metricName: "Product Launch Success", value: 98, managerId: positiveManager._id },
            { metricName: "Team Velocity", value: 95, managerId: positiveManager._id },
        ]);
        console.log(`Added metrics for ${positiveManager.name}`);

        console.log("\n============================================");
        console.log("✅ Done seeding!");
        console.log("============================================");
        console.log("\n📋 Login Credentials:");
        console.log("──────────────────────────────────────────");
        console.log("MANAGERS:");
        console.log("  jordan.lee@company.com / password123");
        console.log("  alex.morgan@company.com / password123");
        console.log("  diana.prince@company.com / password123");
        console.log("\nEMPLOYEES:");
        console.log("  sam.wilson@company.com / password123");
        console.log("  casey.smith@company.com / password123");
        console.log("  jamie.doe@company.com / password123");
        console.log("  taylor.brown@company.com / password123");
        console.log("  riley.green@company.com / password123");
        console.log("  morgan.white@company.com / password123");
        console.log("  quinn.black@company.com / password123");
        console.log("  bruce.w@company.com / password123");
        console.log("  clark.k@company.com / password123");
        console.log("  barry.a@company.com / password123");
        console.log("──────────────────────────────────────────");

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
