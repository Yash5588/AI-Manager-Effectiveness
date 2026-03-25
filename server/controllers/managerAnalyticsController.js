const User = require("../models/User");
const Feedback = require("../models/Feedback");
const PerformanceMetric = require("../models/PerformanceMetric");
const ManagerExtendedMetrics = require("../models/ManagerExtendedMetrics");
const ScoreSnapshot = require("../models/ScoreSnapshot");
const { predictTeamAttrition } = require("../services/attritionService");
const { generateAISuggestions, generateEmployeeSuggestions, generateImprovementRoadmap } = require("../services/aiSuggestionsService");
const { buildEmployeeCoachingProfiles } = require("../services/employeeCoachingService");
const {
  buildMonthlyTimeline,
  computeManagerAnalytics: computeSharedManagerAnalytics,
  computeManagerScoreFromInputs,
  computeRecentTrend,
  fetchManagerScoringInputs,
  getFeedbackDateFilter,
  getTierByPercentile,
  toObjectId,
  toPlainObject,
} = require("../services/managerAnalyticsService");

const FEEDBACK_AI_LIMIT = 20;

exports.getManagerAnalytics = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const analytics = await computeSharedManagerAnalytics(managerId);
    const {
      employees,
      feedbacks,
      metrics,
      extendedMetrics,
      finalScore,
      secondaryMetrics,
      primaryMetrics,
      counts,
      category,
    } = analytics;

    const latestSnapshot = await ScoreSnapshot.findOne({
      managerId,
      aiReasoning: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    const newestFeedback = await Feedback.findOne({ managerId: toObjectId(managerId), ...getFeedbackDateFilter() })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();

    const hasNewData = !latestSnapshot ||
      (newestFeedback && new Date(newestFeedback.createdAt) > new Date(latestSnapshot.createdAt));

    let aiInsights = {};
    if (hasNewData && feedbacks.length > 0) {
      try {
        const { computeAIInsights } = require("../services/aiScoringService");
        aiInsights = await computeAIInsights({
          manager: toPlainObject(manager),
          employees: employees.map(toPlainObject),
          feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(toPlainObject),
          metrics: metrics.map(toPlainObject),
          extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
          breakdown: secondaryMetrics,
          formulaScore: finalScore,
        });

        await ScoreSnapshot.create({
          managerId,
          finalScore,
          breakdown: primaryMetrics,
          category,
          counts,
          aiScore: finalScore,
          aiBreakdown: secondaryMetrics,
          aiReasoning: aiInsights.aiReasoning || null,
          aiStrengths: aiInsights.aiStrengths || [],
          aiWeaknesses: aiInsights.aiWeaknesses || [],
        });
        console.log(`🔄 Fresh insights generated and cached for ${manager.name}`);
      } catch (err) {
        console.error(`⚠️ On-demand insights failed for ${manager.name}:`, err.message);
        if (latestSnapshot) {
          aiInsights = {
            aiReasoning: latestSnapshot.aiReasoning,
            aiStrengths: latestSnapshot.aiStrengths,
            aiWeaknesses: latestSnapshot.aiWeaknesses,
          };
        }
      }
    } else if (latestSnapshot) {
      aiInsights = {
        aiReasoning: latestSnapshot.aiReasoning,
        aiStrengths: latestSnapshot.aiStrengths,
        aiWeaknesses: latestSnapshot.aiWeaknesses,
      };
    }

    const response = {
      manager: {
        ...toPlainObject(manager),
        effectivenessScore: finalScore,
      },
      breakdown: {
        ...primaryMetrics,
        ...secondaryMetrics,
      },
      extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
      finalScore,
      aiScore: finalScore,
      aiReasoning: aiInsights.aiReasoning || null,
      aiStrengths: aiInsights.aiStrengths || [],
      aiWeaknesses: aiInsights.aiWeaknesses || [],
      category,
      weights: {},
      counts,
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/manager-analytics/:managerId/suggestions
exports.generateSuggestions = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const analytics = await computeSharedManagerAnalytics(managerId);
    const {
      employees,
      feedbacks,
      metrics,
      extendedMetrics,
      finalScore,
      secondaryMetrics,
      category,
      counts,
    } = analytics;

    const payload = {
      manager: toPlainObject(manager),
      employees: employees.map(toPlainObject),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(toPlainObject),
      metrics: metrics.map(toPlainObject),
      extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
      breakdown: secondaryMetrics,
      finalScore,
      category,
      counts,
    };

    const suggestions = await generateAISuggestions(payload);
    res.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    const msg = error.message || "Failed to generate suggestions";
    const status =
      msg.includes("OPENROUTER_API_KEY") ||
      msg.includes("API key") ||
      msg.includes("OpenRouter authentication failed")
        ? 503
        : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/manager-analytics/:managerId/employee-suggestions
exports.generateEmployeeSuggestionsHandler = async (req, res) => {
  try {
    const { managerId } = req.params;
    const EmployeeSuggestionsCache = require("../models/EmployeeSuggestionsCache");
    const forceRegenerate = req.body.regenerate === true;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Check for cached suggestions (skip if user explicitly wants to regenerate)
    if (!forceRegenerate) {
      const cached = await EmployeeSuggestionsCache.findOne({ managerId }).sort({ createdAt: -1 }).lean();

      if (cached) {
        // Check if new feedback arrived since cache was created
        const newestFeedback = await Feedback.findOne({ managerId: toObjectId(managerId), ...getFeedbackDateFilter() })
          .sort({ createdAt: -1 }).select("createdAt").lean();

        const cacheIsFresh = !newestFeedback || new Date(newestFeedback.createdAt) <= new Date(cached.createdAt);

        if (cacheIsFresh) {
          console.log(`📦 Serving cached employee suggestions for ${manager.name}`);
          return res.json({ employeeSuggestions: cached.suggestions, currentScore: cached.currentScore, cached: true });
        }
      }
    }

    // Cache miss or stale — generate fresh suggestions
    const [employees, feedbacks, metrics, extendedMetrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }).lean(),
      Feedback.find({
        managerId: toObjectId(managerId),
        ...getFeedbackDateFilter(),
      }).lean(),
      PerformanceMetric.find({ managerId }),
      ManagerExtendedMetrics.findOne({ managerId }).lean(),
    ]);

    const { finalScore } = computeManagerScoreFromInputs({
      employees,
      feedbacks,
      metrics,
      extendedMetrics,
    });

    const coachingData = buildEmployeeCoachingProfiles({
      employees,
      feedbacks,
      extendedMetrics,
    });

    const payload = {
      manager: toPlainObject(manager),
      coachingProfiles: coachingData.employees,
      teamMetrics: coachingData.teamMetrics,
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT),
      finalScore,
    };

    const employeeSuggestions = await generateEmployeeSuggestions(payload);

    // Cache the result (replace old cache for this manager)
    await EmployeeSuggestionsCache.findOneAndUpdate(
      { managerId },
      { managerId, suggestions: employeeSuggestions, currentScore: finalScore },
      { upsert: true, new: true }
    );
    console.log(`🔄 Fresh employee suggestions generated and cached for ${manager.name}`);

    res.json({ employeeSuggestions, currentScore: finalScore, cached: false });
  } catch (error) {
    console.error("Employee suggestions error:", error);
    const msg = error.message || "Failed to generate employee suggestions";
    const status =
      msg.includes("OPENROUTER_API_KEY") ||
      msg.includes("API key") ||
      msg.includes("OpenRouter authentication failed")
        ? 503
        : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/manager-analytics/:managerId/attrition-risk
exports.getAttritionPredictions = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const { employees, feedbacks, metrics, extendedMetrics } = await fetchManagerScoringInputs(managerId);

    const payload = {
      manager: toPlainObject(manager),
      employees: employees.map(toPlainObject),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(toPlainObject),
      metrics: metrics.map(toPlainObject),
      extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
    };

    const predictions = await predictTeamAttrition(payload);
    res.json({ predictions });
  } catch (error) {
    console.error("Attrition prediction error:", error);
    const msg = error.message || "Failed to predict attrition";
    const status =
      msg.includes("OPENROUTER_API_KEY") ||
      msg.includes("API key") ||
      msg.includes("OpenRouter authentication failed")
        ? 503
        : 500;
    res.status(status).json({ message: msg });
  }
};

// POST /api/manager-analytics/:managerId/improvement-roadmap
exports.generateImprovementRoadmapHandler = async (req, res) => {
  try {
    const { managerId } = req.params;
    const ImprovementRoadmap = require("../models/ImprovementRoadmap");
    const forceRegenerate = req.body.regenerate === true;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    // Check for cached roadmap (skip if user explicitly wants to regenerate)
    if (!forceRegenerate) {
      const cached = await ImprovementRoadmap.findOne({ managerId }).sort({ createdAt: -1 }).lean();

      if (cached) {
        // Check if new feedback arrived since cache was created
        const newestFeedback = await Feedback.findOne({ managerId: toObjectId(managerId), ...getFeedbackDateFilter() })
          .sort({ createdAt: -1 }).select("createdAt").lean();

        const cacheIsFresh = !newestFeedback || new Date(newestFeedback.createdAt) <= new Date(cached.createdAt);

        if (cacheIsFresh) {
          console.log(`📦 Serving cached improvement roadmap for ${manager.name}`);
          return res.json({ roadmap: cached.roadmap, message: cached.message || null, cached: true });
        }
      }
    }

    // Cache miss or stale — generate fresh roadmap
    const analytics = await computeSharedManagerAnalytics(managerId);
    const { feedbacks, extendedMetrics, finalScore, secondaryMetrics } = analytics;

    const payload = {
      manager: toPlainObject(manager),
      feedbacks: feedbacks.slice(0, FEEDBACK_AI_LIMIT).map(toPlainObject),
      breakdown: secondaryMetrics,
      extendedMetrics: extendedMetrics ? toPlainObject(extendedMetrics) : {},
      finalScore,
    };

    const result = await generateImprovementRoadmap(payload);

    // Cache the result (replace old cache for this manager)
    await ImprovementRoadmap.findOneAndUpdate(
      { managerId },
      { managerId, roadmap: result.roadmap || [], message: result.message || null },
      { upsert: true, new: true }
    );
    console.log(`🔄 Fresh improvement roadmap generated and cached for ${manager.name}`);

    res.json({ ...result, cached: false });
  } catch (error) {
    console.error("Improvement roadmap error:", error);
    const msg = error.message || "Failed to generate improvement roadmap";
    const status =
      msg.includes("OPENROUTER_API_KEY") ||
      msg.includes("API key") ||
      msg.includes("OpenRouter authentication failed")
        ? 503
        : 500;
    res.status(status).json({ message: msg });
  }
};

// GET /api/manager-analytics/:managerId/employee-coaching
exports.getEmployeeCoachingData = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [employees, feedbacks, extendedMetrics] = await Promise.all([
      User.find({ managerId, userType: "employee" }).lean(),
      Feedback.find({
        managerId: toObjectId(managerId),
        ...getFeedbackDateFilter(),
      }).lean(),
      ManagerExtendedMetrics.findOne({ managerId }).lean(),
    ]);

    res.json(buildEmployeeCoachingProfiles({ employees, feedbacks, extendedMetrics }));
  } catch (error) {
    console.error("Employee coaching data error:", error);
    res.status(500).json({ message: "Failed to load employee coaching data" });
  }
};

// GET /api/manager-analytics/:managerId/leaderboard
exports.getManagerLeaderboard = async (req, res) => {
  try {
    const { managerId } = req.params;

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    if (!manager.hrId) {
      return res.status(400).json({ message: "Manager has no assigned HR" });
    }

    const peerManagers = await User.find({ hrId: manager.hrId, userType: "manager" }).select("-password");

    const leaderboard = await Promise.all(
      peerManagers.map(async (mgr) => {
        const [analytics, trend] = await Promise.all([
          computeSharedManagerAnalytics(mgr._id),
          computeRecentTrend(mgr._id, 2),
        ]);

        return {
          id: mgr._id,
          name: mgr.name,
          department: mgr.department,
          email: mgr.email,
          experienceYears: mgr.experienceYears,
          effectivenessScore: analytics.finalScore,
          sentimentScore: analytics.avgFeedbackScore,
          category: analytics.category,
          counts: analytics.counts,
          trend,
        };
      })
    );

    leaderboard.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
    leaderboard.forEach((m, i) => { m.rank = i + 1; });

    res.json(leaderboard);
  } catch (error) {
    console.error("Manager leaderboard error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/manager-analytics/:managerId/peer-trends
exports.getPeerTrendBenchmark = async (req, res) => {
  try {
    const { managerId } = req.params;
    const monthsParam = parseInt(req.query.months, 10);
    const months = Number.isNaN(monthsParam) ? 12 : Math.min(24, Math.max(3, monthsParam));

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    let peerManagers = [];
    if (manager.hrId) {
      peerManagers = await User.find({ hrId: manager.hrId, userType: "manager" }).select("-password");
    } else {
      peerManagers = [manager];
    }

    const managerScores = await Promise.all(
      peerManagers.map(async (mgr) => {
        const analytics = await computeSharedManagerAnalytics(mgr._id);
        return {
          id: mgr._id.toString(),
          name: mgr.name,
          department: mgr.department,
          effectivenessScore: analytics.finalScore,
          category: analytics.category,
        };
      })
    );

    managerScores.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
    managerScores.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const selfEntry = managerScores.find((entry) => entry.id === managerId);
    if (!selfEntry) {
      return res.status(404).json({ message: "Manager is not in peer group" });
    }

    const totalPeers = managerScores.length;
    const managerAbove = selfEntry.rank > 1 ? managerScores[selfEntry.rank - 2] : null;
    const managerBelow = selfEntry.rank < totalPeers ? managerScores[selfEntry.rank] : null;
    const topEntry = managerScores[0];
    const topPercentile = totalPeers > 1
      ? Math.round(((totalPeers - selfEntry.rank) / (totalPeers - 1)) * 100)
      : 100;

    const timeline = buildMonthlyTimeline(months);
    const startMonth = timeline[0];
    const monthStartDate = new Date(
      parseInt(startMonth.monthKey.slice(0, 4), 10),
      parseInt(startMonth.monthKey.slice(5, 7), 10) - 1,
      1
    );

    const peerObjectIds = peerManagers.map((mgr) => toObjectId(mgr._id));

    const snapshots = await ScoreSnapshot.aggregate([
      {
        $match: {
          managerId: { $in: peerObjectIds },
          createdAt: { $gte: monthStartDate },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            managerId: "$managerId",
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          finalScore: { $first: "$finalScore" },
        },
      },
      {
        $project: {
          _id: 0,
          managerId: "$_id.managerId",
          finalScore: 1,
          monthKey: {
            $dateToString: {
              format: "%Y-%m",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: 1,
                },
              },
            },
          },
        },
      },
    ]);

    const scoreMap = new Map();
    snapshots.forEach((snap) => {
      const peerId = snap.managerId.toString();
      if (!scoreMap.has(peerId)) {
        scoreMap.set(peerId, new Map());
      }
      scoreMap.get(peerId).set(snap.monthKey, snap.finalScore);
    });

    const buildPoints = (peerId) =>
      timeline.map((month) => ({
        monthKey: month.monthKey,
        label: month.label,
        score: scoreMap.get(peerId)?.get(month.monthKey) ?? null,
      }));

    const series = [];
    const usedIds = new Set();
    const addSeries = (entry, key, relation, suffix = "") => {
      if (!entry || usedIds.has(entry.id)) return;
      usedIds.add(entry.id);
      const points = buildPoints(entry.id);
      const hasAnyPoint = points.some((point) => typeof point.score === "number");
      if (!hasAnyPoint && points.length > 0 && typeof entry.effectivenessScore === "number") {
        points[points.length - 1].score = entry.effectivenessScore;
      }
      series.push({
        key,
        relation,
        managerId: entry.id,
        name: suffix ? `${entry.name} ${suffix}` : entry.name,
        rank: entry.rank,
        latestScore: entry.effectivenessScore,
        points,
      });
    };

    addSeries(selfEntry, "self", "self", "(You)");
    if (topEntry.id !== selfEntry.id) addSeries(topEntry, "top", "top", "(Top)");
    if (managerAbove && managerAbove.id !== topEntry.id && managerAbove.id !== selfEntry.id) {
      addSeries(managerAbove, "above", "above", "(Ahead)");
    }
    if (managerBelow && managerBelow.id !== selfEntry.id) {
      addSeries(managerBelow, "below", "below", "(Behind)");
    }

    const peerAveragePoints = timeline.map((month) => {
      const monthlyScores = managerScores
        .map((entry) => scoreMap.get(entry.id)?.get(month.monthKey))
        .filter((value) => typeof value === "number");

      const avgScore = monthlyScores.length > 0
        ? Math.round(monthlyScores.reduce((sum, value) => sum + value, 0) / monthlyScores.length)
        : null;

      return {
        monthKey: month.monthKey,
        label: month.label,
        score: avgScore,
      };
    });

    const hasPeerAveragePoints = peerAveragePoints.some((point) => typeof point.score === "number");
    if (!hasPeerAveragePoints && peerAveragePoints.length > 0) {
      const currentAvg = Math.round(
        managerScores.reduce((sum, entry) => sum + entry.effectivenessScore, 0) / managerScores.length
      );
      peerAveragePoints[peerAveragePoints.length - 1].score = currentAvg;
    }

    series.push({
      key: "peer_avg",
      relation: "peer_avg",
      managerId: null,
      name: "Peer Average",
      rank: null,
      latestScore: null,
      points: peerAveragePoints,
    });

    const selfSeries = series.find((item) => item.key === "self");
    let abovePeerAverageStreak = 0;
    if (selfSeries) {
      for (let i = peerAveragePoints.length - 1; i >= 0; i -= 1) {
        const selfScore = selfSeries.points[i]?.score;
        const avgScore = peerAveragePoints[i]?.score;
        if (typeof selfScore !== "number" || typeof avgScore !== "number" || selfScore < avgScore) {
          break;
        }
        abovePeerAverageStreak += 1;
      }
    }

    res.json({
      timeframe: {
        months,
        start: timeline[0]?.monthKey ?? null,
        end: timeline[timeline.length - 1]?.monthKey ?? null,
      },
      summary: {
        rank: selfEntry.rank,
        totalPeers,
        topPercentile,
        tier: getTierByPercentile(topPercentile),
        currentScore: selfEntry.effectivenessScore,
        category: selfEntry.category,
        scoreGapToTop: Math.max(0, topEntry.effectivenessScore - selfEntry.effectivenessScore),
        scoreGapToNext: managerAbove
          ? Math.max(0, managerAbove.effectivenessScore - selfEntry.effectivenessScore)
          : 0,
        scoreLeadOverBelow: managerBelow
          ? Math.max(0, selfEntry.effectivenessScore - managerBelow.effectivenessScore)
          : 0,
        nextManagerName: managerAbove ? managerAbove.name : null,
        belowManagerName: managerBelow ? managerBelow.name : null,
        abovePeerAverageStreak,
      },
      series,
    });
  } catch (error) {
    console.error("Peer trend benchmark error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
