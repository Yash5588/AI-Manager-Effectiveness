const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { computeCompositeFeedbackScore } = require("../services/feedbackScoringService");
const { computeManagerAnalytics } = require("../services/managerAnalyticsService");

const TEST_PASSWORD = "Password@123";

const managers = [
  {
    name: "Aisha Raman",
    email: "aisha.raman.leaderboard.test@example.com",
    department: "Engineering",
    experienceYears: 9,
    metrics: [92, 88, 90],
    extendedMetrics: {
      teamRetentionRate: 94,
      goalCompletionRate: 91,
      employeePromotionRate: 30,
      subordinate360Rating: 89,
      employeeEngagementScore: 92,
      IDP: 4,
    },
    employees: [
      ["Neha Shah", "Backend Engineer", 5, 0.92, "thriving"],
      ["Arjun Mehta", "Frontend Engineer", 4.7, 0.88, "happy"],
      ["Maya Iyer", "QA Engineer", 4.8, 0.9, "happy"],
      ["Dev Patel", "Platform Engineer", 4.6, 0.86, "thriving"],
    ],
    trendDelta: 5,
  },
  {
    name: "Priya Nair",
    email: "priya.nair.leaderboard.test@example.com",
    department: "Product",
    experienceYears: 7,
    metrics: [84, 82, 86],
    extendedMetrics: {
      teamRetentionRate: 88,
      goalCompletionRate: 84,
      employeePromotionRate: 22,
      subordinate360Rating: 82,
      employeeEngagementScore: 85,
      IDP: 3,
    },
    employees: [
      ["Rohan Das", "Product Analyst", 4.4, 0.82, "happy"],
      ["Isha Kapoor", "Product Designer", 4.2, 0.8, "happy"],
      ["Karan Malhotra", "Business Analyst", 4.3, 0.79, "neutral"],
      ["Meera Joshi", "Scrum Master", 4.5, 0.84, "happy"],
    ],
    trendDelta: 3,
  },
  {
    name: "Vikram Rao",
    email: "vikram.rao.leaderboard.test@example.com",
    department: "Customer Success",
    experienceYears: 11,
    metrics: [72, 74, 70],
    extendedMetrics: {
      teamRetentionRate: 78,
      goalCompletionRate: 73,
      employeePromotionRate: 14,
      subordinate360Rating: 70,
      employeeEngagementScore: 76,
      IDP: 2,
    },
    employees: [
      ["Ananya Verma", "Customer Success Associate", 3.8, 0.7, "neutral"],
      ["Siddharth Jain", "Implementation Specialist", 3.9, 0.72, "happy"],
      ["Pooja Menon", "Support Analyst", 3.6, 0.68, "neutral"],
      ["Nikhil Reddy", "Solutions Consultant", 4.0, 0.74, "happy"],
    ],
    trendDelta: -2,
  },
  {
    name: "Nisha Kapoor",
    email: "nisha.kapoor.leaderboard.test@example.com",
    department: "Operations",
    experienceYears: 8,
    metrics: [76, 78, 74],
    extendedMetrics: {
      teamRetentionRate: 82,
      goalCompletionRate: 79,
      employeePromotionRate: 18,
      subordinate360Rating: 76,
      employeeEngagementScore: 80,
      IDP: 3,
    },
    employees: [
      ["Harsh Vardhan", "Operations Analyst", 4.1, 0.76, "happy"],
      ["Sneha Kulkarni", "Process Associate", 4.0, 0.75, "happy"],
      ["Varun Singh", "Workflow Specialist", 3.9, 0.73, "neutral"],
      ["Diya Bansal", "Program Coordinator", 4.2, 0.78, "happy"],
    ],
    trendDelta: 2,
  },
  {
    name: "Rahul Sethi",
    email: "rahul.sethi.leaderboard.test@example.com",
    department: "Sales",
    experienceYears: 6,
    metrics: [68, 70, 72],
    extendedMetrics: {
      teamRetentionRate: 76,
      goalCompletionRate: 71,
      employeePromotionRate: 12,
      subordinate360Rating: 69,
      employeeEngagementScore: 73,
      IDP: 2,
    },
    employees: [
      ["Aarav Gupta", "Account Executive", 3.8, 0.7, "neutral"],
      ["Tara Sen", "Sales Specialist", 3.7, 0.69, "neutral"],
      ["Kabir Khan", "Sales Analyst", 3.9, 0.71, "happy"],
      ["Ritika Bose", "Customer Executive", 3.8, 0.7, "neutral"],
    ],
    trendDelta: 1,
  },
];

function categoryFromScore(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Average";
  return "Needs Improvement";
}

async function getTargetHr() {
  const managerWithHr = await User.findOne({ userType: "manager", hrId: { $exists: true, $ne: null } }).lean();
  if (managerWithHr?.hrId) return managerWithHr.hrId;

  const hr = await User.findOne({ userType: "hr" }).lean();
  if (!hr) {
    throw new Error("No HR user found. Create/login as an HR first, then rerun this seed.");
  }

  return hr._id;
}

async function upsertUserByEmail(payload) {
  const existing = await User.findOne({ email: payload.email });
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return User.create({ ...payload, password: TEST_PASSWORD });
}

function buildFeedback({ employee, managerId, sentimentScore, mood }) {
  const rating = Math.max(1, Math.min(5, Math.round((sentimentScore * 4 + 1) * 10) / 10));
  const feedback = {
    fromEmployee: employee.name,
    employeeId: employee._id,
    managerId,
    comment: `Testing feedback for ${employee.name}: clear priorities, useful coaching, and steady follow-up on blockers.`,
    sentimentScore,
    ratings: {
      communication: rating,
      recognition: rating,
      availability: Math.max(1, rating - 0.1),
      careerGrowth: Math.max(1, rating - 0.2),
      empowerment: rating,
      fairness: rating,
      decisionMaking: Math.max(1, rating - 0.1),
      conflictResolution: Math.max(1, rating - 0.2),
    },
    npsScore: Math.round(sentimentScore * 10),
    feedbackCategory: "leadership",
    feedbackType: sentimentScore >= 0.75 ? "appreciation" : "suggestion",
    pulseMood: mood,
    oneOnOneFrequency: sentimentScore >= 0.8 ? "weekly" : "biweekly",
    feedbackFrequency: sentimentScore >= 0.8 ? "weekly" : "monthly",
    concernResponseTime: sentimentScore >= 0.8 ? "same_day" : "within_week",
    peerComparison: sentimentScore >= 0.8 ? "better" : "same",
    timePeriod: "last_month",
    willingToFollowUp: true,
    urgency: sentimentScore >= 0.75 ? "low" : "medium",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  feedback.compositeFeedbackScore = computeCompositeFeedbackScore(feedback);
  return feedback;
}

async function seedManager(managerData, hrId) {
  const manager = await upsertUserByEmail({
    name: managerData.name,
    email: managerData.email,
    userType: "manager",
    department: managerData.department,
    experienceYears: managerData.experienceYears,
    hrId,
  });

  const employees = [];
  for (const [name, role, performanceRating] of managerData.employees) {
    const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}.leaderboard.test@example.com`;
    const employee = await upsertUserByEmail({
      name,
      email,
      userType: "employee",
      role,
      performanceRating,
      managerId: manager._id,
    });
    employees.push(employee);
  }

  await Promise.all([
    Feedback.deleteMany({ managerId: manager._id }),
    PerformanceMetric.deleteMany({ managerId: manager._id }),
    ScoreSnapshot.deleteMany({ managerId: manager._id }),
  ]);

  await ManagerExtendedMetrics.findOneAndUpdate(
    { managerId: manager._id },
    { managerId: manager._id, ...managerData.extendedMetrics },
    { upsert: true, new: true }
  );

  await PerformanceMetric.insertMany(
    managerData.metrics.map((value, index) => ({
      managerId: manager._id,
      metricName: ["Delivery Quality", "Operational Health", "Goal Progress"][index],
      value,
    }))
  );

  await Feedback.insertMany(
    employees.map((employee, index) =>
      buildFeedback({
        employee,
        managerId: manager._id,
        sentimentScore: managerData.employees[index][3],
        mood: managerData.employees[index][4],
      })
    )
  );

  const analytics = await computeManagerAnalytics(manager._id);
  const previousScore = Math.max(0, Math.min(100, analytics.finalScore - managerData.trendDelta));
  const now = new Date();
  const previousMonth = new Date(now);
  previousMonth.setMonth(previousMonth.getMonth() - 1);

  await ScoreSnapshot.insertMany([
    {
      managerId: manager._id,
      finalScore: previousScore,
      breakdown: analytics.primaryMetrics,
      category: categoryFromScore(previousScore),
      counts: analytics.counts,
      createdAt: previousMonth,
      updatedAt: previousMonth,
    },
    {
      managerId: manager._id,
      finalScore: analytics.finalScore,
      breakdown: analytics.primaryMetrics,
      category: analytics.category,
      counts: analytics.counts,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return {
    name: manager.name,
    email: manager.email,
    score: analytics.finalScore,
    employees: employees.length,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in server/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hrId = await getTargetHr();
  const results = [];

  for (const manager of managers) {
    results.push(await seedManager(manager, hrId));
  }

  console.log("Seeded leaderboard test managers:");
  for (const result of results) {
    console.log(`- ${result.name} (${result.email}) score=${result.score}, employees=${result.employees}`);
  }
  console.log(`Password for seeded test users: ${TEST_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
