const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const mongoose = require("mongoose");

// ── Shared helpers (same logic as hrRoutes.js) ──
const FEEDBACK_WINDOW_DAYS = parseInt(process.env.FEEDBACK_WINDOW_DAYS) || 90;

function normalizeEmployeeScore(rating) {
    return (rating - 1) / 4;
}
function normalizeMetricValue(value) {
    return Math.min(1, Math.max(0, value / 100));
}
function getPerformanceCategory(score) {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Average";
    return "Needs Improvement";
}
function getFeedbackDateFilter() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FEEDBACK_WINDOW_DAYS);
    return { createdAt: { $gte: cutoff } };
}

// Compute analytics for a single manager
async function computeManagerAnalytics(managerId) {
    const [employees, latestFeedbacks, metrics, latestSnapshot, extendedMetrics] = await Promise.all([
        User.find({ managerId, userType: "employee" }),
        Feedback.aggregate([
            { $match: { managerId: new mongoose.Types.ObjectId(managerId), ...getFeedbackDateFilter() } },
            { $sort: { createdAt: -1 } },
            { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { createdAt: -1 } },
        ]),
        PerformanceMetric.find({ managerId }),
        ScoreSnapshot.findOne({ managerId, aiScore: { $exists: true } }).sort({ createdAt: -1 }),
        ManagerExtendedMetrics.findOne({ managerId }),
    ]);

    const feedbacks = latestFeedbacks;

    const avgEmployeeScore =
        employees.length > 0
            ? employees.reduce((s, e) => s + normalizeEmployeeScore(e.performanceRating), 0) / employees.length
            : 0.5;
    const avgFeedbackScore =
        feedbacks.length > 0
            ? feedbacks.reduce((s, f) => s + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / feedbacks.length
            : 0.5;
    const avgMetricScore =
        metrics.length > 0
            ? metrics.reduce((s, m) => s + normalizeMetricValue(m.value), 0) / metrics.length
            : 0.5;

    let breakdown = {
        avgEmployeeScore: Math.round(avgEmployeeScore * 100) / 100,
        avgFeedbackScore: Math.round(avgFeedbackScore * 100) / 100,
        avgMetricScore: Math.round(avgMetricScore * 100) / 100,
    };

    let finalScore;
    if (latestSnapshot) {
        finalScore = latestSnapshot.aiScore;
        if (latestSnapshot.aiBreakdown) {
            breakdown = { ...breakdown, ...latestSnapshot.aiBreakdown };
            if (latestSnapshot.aiBreakdown.feedbackSentiment !== undefined) {
                breakdown.avgFeedbackScore = latestSnapshot.aiBreakdown.feedbackSentiment / 100;
            }
        }
    } else {
        finalScore = Math.round(
            (avgEmployeeScore * 0.4 + avgFeedbackScore * 0.3 + avgMetricScore * 0.3) * 100
        );
    }

    const category = getPerformanceCategory(finalScore);

    // Get trend data
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const recentSnapshots = await ScoreSnapshot.find({
        managerId,
        createdAt: { $gte: twoMonthsAgo },
    }).sort({ createdAt: 1 });

    let trend = 0;
    if (recentSnapshots.length >= 2) {
        trend = recentSnapshots[recentSnapshots.length - 1].finalScore - recentSnapshots[0].finalScore;
    }

    return {
        breakdown,
        extendedMetrics: extendedMetrics ? (extendedMetrics.toObject ? extendedMetrics.toObject() : extendedMetrics) : {},
        finalScore,
        category,
        trend,
        counts: { employees: employees.length, feedbacks: feedbacks.length, metrics: metrics.length },
        aiStrengths: latestSnapshot?.aiStrengths || [],
        aiWeaknesses: latestSnapshot?.aiWeaknesses || [],
    };
}

// ── HTML Email Templates ──

function getEmailStyles() {
    return `
        body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Segoe UI', Tahoma, sans-serif; }
        .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; }
        .header p { color: #bfdbfe; margin: 6px 0 0; font-size: 14px; }
        .body { padding: 24px; }
        .stat-grid { display: flex; gap: 12px; margin: 16px 0; }
        .stat-card { flex: 1; background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-value { font-size: 28px; font-weight: 700; color: #1e40af; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .section-title { font-size: 16px; font-weight: 600; color: #1e293b; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th { background: #f1f5f9; color: #475569; font-size: 12px; padding: 10px 12px; text-align: left; font-weight: 600; text-transform: uppercase; }
        td { padding: 10px 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-excellent { background: #dcfce7; color: #166534; }
        .badge-good { background: #dbeafe; color: #1e40af; }
        .badge-average { background: #fef9c3; color: #854d0e; }
        .badge-needs { background: #fee2e2; color: #991b1b; }
        .trend-up { color: #16a34a; }
        .trend-down { color: #dc2626; }
        .trend-flat { color: #64748b; }
        .strengths { background: #f0fdf4; border-radius: 8px; padding: 12px 16px; margin: 8px 0; }
        .weaknesses { background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin: 8px 0; }
        .footer { text-align: center; padding: 20px 24px; background: #f8fafc; color: #94a3b8; font-size: 12px; }
        .score-big { font-size: 48px; font-weight: 800; color: #1e40af; text-align: center; margin: 12px 0 4px; }
        .category-big { text-align: center; font-size: 16px; margin-bottom: 16px; }
        ul { margin: 4px 0; padding-left: 20px; }
        li { font-size: 13px; color: #334155; margin: 4px 0; }
    `;
}

function getBadgeClass(category) {
    if (category === "Excellent") return "badge-excellent";
    if (category === "Good") return "badge-good";
    if (category === "Average") return "badge-average";
    return "badge-needs";
}

function getTrendIcon(trend) {
    if (trend > 0) return `<span class="trend-up">▲ +${trend}</span>`;
    if (trend < 0) return `<span class="trend-down">▼ ${trend}</span>`;
    return `<span class="trend-flat">● 0</span>`;
}

function getMonthName() {
    const months = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    // Report is for the previous month
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return `${months[prevMonth]} ${year}`;
}

// ── Generate HR Report ──

async function generateHRReport(hrId) {
    const hr = await User.findById(hrId).select("-password");
    if (!hr) throw new Error("HR user not found");

    const managers = await User.find({ hrId, userType: "manager" }).select("-password");
    if (managers.length === 0) {
        return {
            to: hr.email,
            subject: `📊 Monthly Effectiveness Report — ${getMonthName()}`,
            html: buildHREmptyHTML(hr),
        };
    }

    // Compute analytics for all managers
    const managerData = await Promise.all(
        managers.map(async (mgr) => {
            const analytics = await computeManagerAnalytics(mgr._id);
            return { name: mgr.name, email: mgr.email, department: mgr.department, ...analytics };
        })
    );

    // Compute aggregates
    const totalEmployees = managerData.reduce((s, m) => s + m.counts.employees, 0);
    const totalFeedbacks = managerData.reduce((s, m) => s + m.counts.feedbacks, 0);
    const avgEffectiveness = Math.round(managerData.reduce((s, m) => s + m.finalScore, 0) / managerData.length);

    // Sort for leaderboard
    const sorted = [...managerData].sort((a, b) => b.finalScore - a.finalScore);
    const topPerformers = sorted.slice(0, 3);
    const lowPerformers = sorted.filter((m) => m.category === "Needs Improvement" || m.category === "Average");

    const reportData = {
        hr,
        managers: managerData,
        totalEmployees,
        totalFeedbacks,
        avgEffectiveness,
        topPerformers,
        lowPerformers,
        sorted,
    };

    return {
        to: hr.email,
        subject: `📊 Monthly Effectiveness Report — ${getMonthName()}`,
        html: buildHRReportHTML(reportData),
    };
}

function buildHREmptyHTML(hr) {
    return `<!DOCTYPE html><html><head><style>${getEmailStyles()}</style></head><body>
        <div class="container">
            <div class="header"><h1>Darwinbox Effectiveness</h1><p>Monthly Report — ${getMonthName()}</p></div>
            <div class="body"><p>Hi ${hr.name},</p><p>No managers are currently assigned to you. Once managers are added, you'll receive a detailed report here.</p></div>
            <div class="footer">Darwinbox AI Manager Effectiveness</div>
        </div></body></html>`;
}

function buildHRReportHTML(data) {
    const { hr, sorted, totalEmployees, totalFeedbacks, avgEffectiveness, topPerformers, lowPerformers } = data;

    const managerRows = sorted.map((m, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${m.name}</strong></td>
            <td>${m.department || "—"}</td>
            <td><strong>${m.finalScore}</strong></td>
            <td><span class="badge ${getBadgeClass(m.category)}">${m.category}</span></td>
            <td>${getTrendIcon(m.trend)}</td>
            <td>${m.counts.employees}</td>
        </tr>
    `).join("");

    const topRows = topPerformers.map((m, i) => `
        <tr><td>${["🥇", "🥈", "🥉"][i]}</td><td>${m.name}</td><td>${m.finalScore}</td><td><span class="badge ${getBadgeClass(m.category)}">${m.category}</span></td></tr>
    `).join("");

    const lowRows = lowPerformers.length > 0
        ? lowPerformers.map((m) => `
            <tr><td>⚠️</td><td>${m.name}</td><td>${m.finalScore}</td><td><span class="badge ${getBadgeClass(m.category)}">${m.category}</span></td></tr>
        `).join("")
        : `<tr><td colspan="4" style="text-align:center; color:#16a34a;">All managers are performing well! 🎉</td></tr>`;

    return `<!DOCTYPE html><html><head><style>${getEmailStyles()}</style></head><body>
        <div class="container">
            <div class="header">
                <h1>📊 Monthly Effectiveness Report</h1>
                <p>${getMonthName()} — Darwinbox Effectiveness</p>
            </div>
            <div class="body">
                <p>Hi <strong>${hr.name}</strong>,</p>
                <p>Here's your organization's monthly manager effectiveness summary:</p>

                <!-- Stats Overview -->
                <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:28px; font-weight:700; color:#1e40af;">${sorted.length}</div>
                        <div style="font-size:12px; color:#64748b;">Managers</div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:28px; font-weight:700; color:#1e40af;">${totalEmployees}</div>
                        <div style="font-size:12px; color:#64748b;">Employees</div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:28px; font-weight:700; color:#1e40af;">${totalFeedbacks}</div>
                        <div style="font-size:12px; color:#64748b;">Feedbacks</div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:28px; font-weight:700; color:#1e40af;">${avgEffectiveness}</div>
                        <div style="font-size:12px; color:#64748b;">Avg Score</div>
                    </td>
                </tr></table>

                <!-- Top Performers -->
                <div class="section-title">🏆 Top Performers</div>
                <table><thead><tr><th></th><th>Manager</th><th>Score</th><th>Category</th></tr></thead>
                <tbody>${topRows}</tbody></table>

                <!-- Attention Needed -->
                <div class="section-title">⚠️ Attention Needed</div>
                <table><thead><tr><th></th><th>Manager</th><th>Score</th><th>Category</th></tr></thead>
                <tbody>${lowRows}</tbody></table>

                <!-- Full Breakdown -->
                <div class="section-title">📋 Full Manager Breakdown</div>
                <table>
                    <thead><tr><th>#</th><th>Manager</th><th>Dept</th><th>Score</th><th>Category</th><th>Trend</th><th>Team</th></tr></thead>
                    <tbody>${managerRows}</tbody>
                </table>
            </div>
            <div class="footer">
                This is an automated report from Darwinbox AI Manager Effectiveness.<br>
                Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </div>
        </div></body></html>`;
}

// ── Generate Manager Report ──

async function generateManagerReport(managerId) {
    const manager = await User.findById(managerId).select("-password");
    if (!manager) throw new Error("Manager not found");

    const analytics = await computeManagerAnalytics(managerId);

    return {
        to: manager.email,
        subject: `🎯 Your Effectiveness Report — ${getMonthName()}`,
        html: buildManagerReportHTML(manager, analytics),
    };
}

function buildManagerReportHTML(manager, analytics) {
    const strengthsList = analytics.aiStrengths.length > 0
        ? analytics.aiStrengths.map((s) => `<li>${s}</li>`).join("")
        : "<li>Not enough data yet</li>";

    const weaknessesList = analytics.aiWeaknesses.length > 0
        ? analytics.aiWeaknesses.map((w) => `<li>${w}</li>`).join("")
        : "<li>No specific areas flagged</li>";

    return `<!DOCTYPE html><html><head><style>${getEmailStyles()}</style></head><body>
        <div class="container">
            <div class="header">
                <h1>🎯 Your Monthly Effectiveness Report</h1>
                <p>${getMonthName()} — Darwinbox Effectiveness</p>
            </div>
            <div class="body">
                <p>Hi <strong>${manager.name}</strong>,</p>
                <p>Here's your effectiveness summary for the past month:</p>

                <!-- Score -->
                <div class="score-big">${analytics.finalScore}</div>
                <div class="category-big"><span class="badge ${getBadgeClass(analytics.category)}">${analytics.category}</span></div>

                <!-- Stats -->
                <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:24px; font-weight:700; color:#1e40af;">${analytics.counts.employees}</div>
                        <div style="font-size:12px; color:#64748b;">Team Members</div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:24px; font-weight:700; color:#1e40af;">${analytics.counts.feedbacks}</div>
                        <div style="font-size:12px; color:#64748b;">Feedbacks</div>
                    </td>
                    <td style="width:12px;"></td>
                    <td style="padding:8px; text-align:center; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:24px; font-weight:700; color:#1e40af;">${getTrendIcon(analytics.trend)}</div>
                        <div style="font-size:12px; color:#64748b;">Trend</div>
                    </td>
                </tr></table>

                <!-- Score Breakdown -->
                <div class="section-title">📊 Score Breakdown</div>
                <table>
                    <thead><tr><th>Metric</th><th>Score</th></tr></thead>
                    <tbody>
                        <tr><td>Employee Performance</td><td>${(analytics.breakdown.avgEmployeeScore * 100).toFixed(0)}%</td></tr>
                        <tr><td>Feedback Sentiment</td><td>${(analytics.breakdown.avgFeedbackScore * 100).toFixed(0)}%</td></tr>
                        <tr><td>KPI Metrics</td><td>${(analytics.breakdown.avgMetricScore * 100).toFixed(0)}%</td></tr>
                    </tbody>
                </table>

                <!-- Strengths -->
                <div class="section-title">💪 Your Strengths</div>
                <div class="strengths"><ul>${strengthsList}</ul></div>

                <!-- Areas for Improvement -->
                <div class="section-title">🔧 Areas for Improvement</div>
                <div class="weaknesses"><ul>${weaknessesList}</ul></div>
            </div>
            <div class="footer">
                This is an automated report from Darwinbox AI Manager Effectiveness.<br>
                Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </div>
        </div></body></html>`;
}

module.exports = { generateHRReport, generateManagerReport, computeManagerAnalytics };
