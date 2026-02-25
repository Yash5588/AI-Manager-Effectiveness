const mongoose = require("mongoose");
const dotenv = require("dotenv");
const HR = require("./models/HR");
const Manager = require("./models/Manager");
const Employee = require("./models/Employee");
const Feedback = require("./models/Feedback");
const PerformanceMetric = require("./models/PerformanceMetric");
const ScoreSnapshot = require("./models/ScoreSnapshot");

dotenv.config();

// ── Helpers for snapshot generation ──
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

        // Clear ALL data
        await Promise.all([
            HR.deleteMany({}),
            Manager.deleteMany({}),
            Employee.deleteMany({}),
            Feedback.deleteMany({}),
            PerformanceMetric.deleteMany({}),
            ScoreSnapshot.deleteMany({}),
        ]);
        console.log("Cleared all existing data.\n");

        // ==========================================
        //  HR USERS
        // ==========================================
        const hr1 = await HR.create({
            name: "Priya Sharma",
            email: "priya.sharma@company.com",
            password: "password123",
            department: "Human Resources",
            designation: "HR Director",
        });
        console.log(`✅ Created HR 1: ${hr1.name} (${hr1.email})`);

        const hr2 = await HR.create({
            name: "Raj Patel",
            email: "raj.patel@company.com",
            password: "password123",
            department: "Human Resources",
            designation: "HR Manager",
        });
        console.log(`✅ Created HR 2: ${hr2.name} (${hr2.email})\n`);

        // ==========================================
        //  HR 1's MANAGERS (existing 3)
        // ==========================================

        // ── Manager 1: Neutral (Operations) ──
        const neutralManager = await Manager.create({
            name: "Jordan Lee",
            email: "jordan.lee@company.com",
            password: "password123",
            department: "Operations",
            experienceYears: 5,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${neutralManager.name} → HR: ${hr1.name}`);

        const neutralEmployees = await Promise.all([
            Employee.create({ name: "Sam Wilson", email: "sam.wilson@company.com", password: "password123", role: "Ops Specialist", performanceRating: 3, managerId: neutralManager._id }),
            Employee.create({ name: "Casey Smith", email: "casey.smith@company.com", password: "password123", role: "Logistics", performanceRating: 4, managerId: neutralManager._id }),
            Employee.create({ name: "Jamie Doe", email: "jamie.doe@company.com", password: "password123", role: "Coordinator", performanceRating: 2, managerId: neutralManager._id }),
            Employee.create({ name: "Taylor Brown", email: "taylor.brown@company.com", password: "password123", role: "Analyst", performanceRating: 3, managerId: neutralManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Sam Wilson", employeeId: neutralEmployees[0]._id, comment: "Jordan is okay, but sometimes instructions are vague.", sentimentScore: 0.5, managerId: neutralManager._id },
            { fromEmployee: "Casey Smith", employeeId: neutralEmployees[1]._id, comment: "Good weekly meetings, but we need more resources.", sentimentScore: 0.6, managerId: neutralManager._id },
            { fromEmployee: "Jamie Doe", employeeId: neutralEmployees[2]._id, comment: "I feel like my career growth is stagnant here.", sentimentScore: 0.3, managerId: neutralManager._id },
            { fromEmployee: "Taylor Brown", employeeId: neutralEmployees[3]._id, comment: "Standard management style. Nothing special but gets the job done.", sentimentScore: 0.5, managerId: neutralManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Project Completion Rate", value: 65, managerId: neutralManager._id },
            { metricName: "Team Efficiency", value: 55, managerId: neutralManager._id },
            { metricName: "Budget Adherence", value: 80, managerId: neutralManager._id },
        ]);

        // ── Manager 2: Negative (Sales) ──
        const negativeManager = await Manager.create({
            name: "Alex Morgan",
            email: "alex.morgan@company.com",
            password: "password123",
            department: "Sales",
            experienceYears: 8,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${negativeManager.name} → HR: ${hr1.name}`);

        const negativeEmployees = await Promise.all([
            Employee.create({ name: "Riley Green", email: "riley.green@company.com", password: "password123", role: "Sales Rep", performanceRating: 2, managerId: negativeManager._id }),
            Employee.create({ name: "Morgan White", email: "morgan.white@company.com", password: "password123", role: "Account Exec", performanceRating: 1, managerId: negativeManager._id }),
            Employee.create({ name: "Quinn Black", email: "quinn.black@company.com", password: "password123", role: "SDR", performanceRating: 2, managerId: negativeManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Riley Green", employeeId: negativeEmployees[0]._id, comment: "Alex is very micromanaging and doesn't trust us.", sentimentScore: 0.2, managerId: negativeManager._id },
            { fromEmployee: "Morgan White", employeeId: negativeEmployees[1]._id, comment: "The pressure is too high and expectations are unrealistic. I am burnt out.", sentimentScore: 0.1, managerId: negativeManager._id },
            { fromEmployee: "Quinn Black", employeeId: negativeEmployees[2]._id, comment: "Rarely available for support. I feel lost in my role.", sentimentScore: 0.25, managerId: negativeManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Sales Quota Attainment", value: 35, managerId: negativeManager._id },
            { metricName: "Client Retention", value: 40, managerId: negativeManager._id },
            { metricName: "Team Morale Survey", value: 20, managerId: negativeManager._id },
        ]);

        // ── Manager 3: Positive (Product) ──
        const positiveManager = await Manager.create({
            name: "Diana Prince",
            email: "diana.prince@company.com",
            password: "password123",
            department: "Product",
            experienceYears: 12,
            hrId: hr1._id,
        });
        console.log(`  📋 Manager: ${positiveManager.name} → HR: ${hr1.name}\n`);

        const positiveEmployees = await Promise.all([
            Employee.create({ name: "Bruce W.", email: "bruce.w@company.com", password: "password123", role: "Product Designer", performanceRating: 5, managerId: positiveManager._id }),
            Employee.create({ name: "Clark K.", email: "clark.k@company.com", password: "password123", role: "Product Manager", performanceRating: 5, managerId: positiveManager._id }),
            Employee.create({ name: "Barry A.", email: "barry.a@company.com", password: "password123", role: "Researcher", performanceRating: 4, managerId: positiveManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Bruce W.", employeeId: positiveEmployees[0]._id, comment: "Diana is an inspiring leader who empowers the team.", sentimentScore: 0.95, managerId: positiveManager._id },
            { fromEmployee: "Clark K.", employeeId: positiveEmployees[1]._id, comment: "Excellent strategic vision and very supportive of personal growth.", sentimentScore: 0.9, managerId: positiveManager._id },
            { fromEmployee: "Barry A.", employeeId: positiveEmployees[2]._id, comment: "Creates a great work environment. Always open to new ideas.", sentimentScore: 0.85, managerId: positiveManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Product Launch Success", value: 98, managerId: positiveManager._id },
            { metricName: "Team Velocity", value: 95, managerId: positiveManager._id },
        ]);

        // ==========================================
        //  HR 2's MANAGERS (3 new ones)
        // ==========================================

        // ── Manager 4: Strong (Engineering) ──
        const engManager = await Manager.create({
            name: "Vikram Desai",
            email: "vikram.desai@company.com",
            password: "password123",
            department: "Engineering",
            experienceYears: 10,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${engManager.name} → HR: ${hr2.name}`);

        const engEmployees = await Promise.all([
            Employee.create({ name: "Ananya Rao", email: "ananya.rao@company.com", password: "password123", role: "Senior Developer", performanceRating: 5, managerId: engManager._id }),
            Employee.create({ name: "Karthik Nair", email: "karthik.nair@company.com", password: "password123", role: "DevOps Engineer", performanceRating: 4, managerId: engManager._id }),
            Employee.create({ name: "Meera Iyer", email: "meera.iyer@company.com", password: "password123", role: "Frontend Developer", performanceRating: 4, managerId: engManager._id }),
            Employee.create({ name: "Rohan Joshi", email: "rohan.joshi@company.com", password: "password123", role: "QA Engineer", performanceRating: 3, managerId: engManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Ananya Rao", employeeId: engEmployees[0]._id, comment: "Vikram is an excellent technical leader. He mentors the team well and gives clear direction.", sentimentScore: 0.92, managerId: engManager._id },
            { fromEmployee: "Karthik Nair", employeeId: engEmployees[1]._id, comment: "Great at delegating tasks and trusting the team. Could improve on providing more regular feedback.", sentimentScore: 0.78, managerId: engManager._id },
            { fromEmployee: "Meera Iyer", employeeId: engEmployees[2]._id, comment: "Very supportive and encourages learning new technologies. Love the tech talks he organizes.", sentimentScore: 0.85, managerId: engManager._id },
            { fromEmployee: "Rohan Joshi", employeeId: engEmployees[3]._id, comment: "Good manager overall. Sometimes deadlines are too tight though.", sentimentScore: 0.6, managerId: engManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Sprint Velocity", value: 88, managerId: engManager._id },
            { metricName: "Bug Resolution Rate", value: 92, managerId: engManager._id },
            { metricName: "Code Review Coverage", value: 85, managerId: engManager._id },
            { metricName: "Deployment Frequency", value: 78, managerId: engManager._id },
        ]);

        // ── Manager 5: Mixed (Marketing) ──
        const mktManager = await Manager.create({
            name: "Sneha Kapoor",
            email: "sneha.kapoor@company.com",
            password: "password123",
            department: "Marketing",
            experienceYears: 6,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${mktManager.name} → HR: ${hr2.name}`);

        const mktEmployees = await Promise.all([
            Employee.create({ name: "Arjun Mehta", email: "arjun.mehta@company.com", password: "password123", role: "Content Strategist", performanceRating: 4, managerId: mktManager._id }),
            Employee.create({ name: "Divya Pillai", email: "divya.pillai@company.com", password: "password123", role: "Social Media Manager", performanceRating: 3, managerId: mktManager._id }),
            Employee.create({ name: "Nikhil Sen", email: "nikhil.sen@company.com", password: "password123", role: "SEO Specialist", performanceRating: 2, managerId: mktManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Arjun Mehta", employeeId: mktEmployees[0]._id, comment: "Sneha has creative ideas but sometimes lacks follow-through on campaign execution.", sentimentScore: 0.55, managerId: mktManager._id },
            { fromEmployee: "Divya Pillai", employeeId: mktEmployees[1]._id, comment: "Decent manager. Wish she would involve us more in strategy decisions.", sentimentScore: 0.45, managerId: mktManager._id },
            { fromEmployee: "Nikhil Sen", employeeId: mktEmployees[2]._id, comment: "Communication could be better. I often don't know priorities until the last minute.", sentimentScore: 0.35, managerId: mktManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "Campaign ROI", value: 62, managerId: mktManager._id },
            { metricName: "Lead Generation", value: 58, managerId: mktManager._id },
            { metricName: "Brand Awareness Score", value: 70, managerId: mktManager._id },
        ]);

        // ── Manager 6: Low (Customer Support) ──
        const csManager = await Manager.create({
            name: "Amit Gupta",
            email: "amit.gupta@company.com",
            password: "password123",
            department: "Customer Support",
            experienceYears: 3,
            hrId: hr2._id,
        });
        console.log(`  📋 Manager: ${csManager.name} → HR: ${hr2.name}\n`);

        const csEmployees = await Promise.all([
            Employee.create({ name: "Pooja Reddy", email: "pooja.reddy@company.com", password: "password123", role: "Support Lead", performanceRating: 3, managerId: csManager._id }),
            Employee.create({ name: "Sanjay Kumar", email: "sanjay.kumar@company.com", password: "password123", role: "Support Agent", performanceRating: 2, managerId: csManager._id }),
            Employee.create({ name: "Lakshmi Bhat", email: "lakshmi.bhat@company.com", password: "password123", role: "Support Agent", performanceRating: 1, managerId: csManager._id }),
            Employee.create({ name: "Farhan Ali", email: "farhan.ali@company.com", password: "password123", role: "Escalation Specialist", performanceRating: 2, managerId: csManager._id }),
        ]);

        await Feedback.insertMany([
            { fromEmployee: "Pooja Reddy", employeeId: csEmployees[0]._id, comment: "Amit is new and still learning. He needs to be more decisive.", sentimentScore: 0.4, managerId: csManager._id },
            { fromEmployee: "Sanjay Kumar", employeeId: csEmployees[1]._id, comment: "There is no clear escalation process. We waste time on unclear priorities.", sentimentScore: 0.25, managerId: csManager._id },
            { fromEmployee: "Lakshmi Bhat", employeeId: csEmployees[2]._id, comment: "I feel unsupported. Training was inadequate and the tools are outdated.", sentimentScore: 0.15, managerId: csManager._id },
            { fromEmployee: "Farhan Ali", employeeId: csEmployees[3]._id, comment: "Amit means well but lacks experience in managing a support team effectively.", sentimentScore: 0.35, managerId: csManager._id },
        ]);

        await PerformanceMetric.insertMany([
            { metricName: "First Response Time", value: 40, managerId: csManager._id },
            { metricName: "Customer Satisfaction", value: 45, managerId: csManager._id },
            { metricName: "Ticket Resolution Rate", value: 55, managerId: csManager._id },
        ]);

        // ==========================================
        //  SCORE SNAPSHOTS (30 days for all 6 managers)
        // ==========================================
        console.log("📈 Generating 30-day score snapshots...");

        const allManagers = [
            { mgr: neutralManager, base: 52, trend: 0.3, vol: 4, emp: 0.5, fb: 0.48, met: 0.67, ec: 4, fc: 4, mc: 3 },
            { mgr: negativeManager, base: 25, trend: -0.1, vol: 3, emp: 0.25, fb: 0.18, met: 0.32, ec: 3, fc: 3, mc: 3 },
            { mgr: positiveManager, base: 88, trend: 0.15, vol: 2, emp: 0.92, fb: 0.9, met: 0.97, ec: 3, fc: 3, mc: 2 },
            { mgr: engManager, base: 78, trend: 0.25, vol: 3, emp: 0.81, fb: 0.79, met: 0.86, ec: 4, fc: 4, mc: 4 },
            { mgr: mktManager, base: 48, trend: 0.1, vol: 4, emp: 0.5, fb: 0.45, met: 0.63, ec: 3, fc: 3, mc: 3 },
            { mgr: csManager, base: 30, trend: 0.2, vol: 3, emp: 0.33, fb: 0.29, met: 0.47, ec: 4, fc: 4, mc: 3 },
        ];

        const DAYS = 30;
        const now = new Date();

        for (const { mgr, base, trend, vol, emp, fb, met, ec, fc, mc } of allManagers) {
            const snapshots = [];
            let empScore = emp, fbScore = fb, metScore = met;

            for (let d = DAYS; d >= 0; d--) {
                const date = new Date(now);
                date.setDate(date.getDate() - d);
                date.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

                empScore = randomWalk(empScore + trend * 0.002, vol * 0.01);
                fbScore = randomWalk(fbScore + trend * 0.002, vol * 0.012);
                metScore = randomWalk(metScore + trend * 0.001, vol * 0.008);

                const rawScore = empScore * 0.4 + fbScore * 0.3 + metScore * 0.3;
                const finalScore = clamp(Math.round(rawScore * 100), 0, 100);
                const category = finalScore >= 85 ? "Excellent" : finalScore >= 70 ? "Good" : finalScore >= 50 ? "Average" : "Needs Improvement";

                snapshots.push({
                    managerId: mgr._id,
                    finalScore,
                    breakdown: {
                        avgEmployeeScore: Math.round(empScore * 100) / 100,
                        avgFeedbackScore: Math.round(fbScore * 100) / 100,
                        avgMetricScore: Math.round(metScore * 100) / 100,
                    },
                    category, counts: { employees: ec, feedbacks: fc, metrics: mc },
                    createdAt: date, updatedAt: date,
                });
            }

            await ScoreSnapshot.insertMany(snapshots);
            const scores = snapshots.map((s) => s.finalScore);
            console.log(`  📊 ${mgr.name}: ${snapshots.length} snapshots (${Math.min(...scores)} → ${Math.max(...scores)})`);
        }

        // ==========================================
        //  SUMMARY
        // ==========================================
        console.log("\n============================================");
        console.log("✅ Done seeding!");
        console.log("============================================");
        console.log("\n📋 Login Credentials:");
        console.log("──────────────────────────────────────────");
        console.log("HR:");
        console.log("  priya.sharma@company.com / password123  (manages: Jordan, Alex, Diana)");
        console.log("  raj.patel@company.com / password123     (manages: Vikram, Sneha, Amit)");
        console.log("\nMANAGERS:");
        console.log("  jordan.lee@company.com / password123");
        console.log("  alex.morgan@company.com / password123");
        console.log("  diana.prince@company.com / password123");
        console.log("  vikram.desai@company.com / password123");
        console.log("  sneha.kapoor@company.com / password123");
        console.log("  amit.gupta@company.com / password123");
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
        console.log("  ananya.rao@company.com / password123");
        console.log("  karthik.nair@company.com / password123");
        console.log("  meera.iyer@company.com / password123");
        console.log("  rohan.joshi@company.com / password123");
        console.log("  arjun.mehta@company.com / password123");
        console.log("  divya.pillai@company.com / password123");
        console.log("  nikhil.sen@company.com / password123");
        console.log("  pooja.reddy@company.com / password123");
        console.log("  sanjay.kumar@company.com / password123");
        console.log("  lakshmi.bhat@company.com / password123");
        console.log("  farhan.ali@company.com / password123");
        console.log("──────────────────────────────────────────");

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedData();
