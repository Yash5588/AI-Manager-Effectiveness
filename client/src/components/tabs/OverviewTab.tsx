import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SentimentTrend } from "@/lib/api";
import { Users, TrendingUp, TrendingDown, BarChart3, MessageSquare, Brain, Sparkles, Rocket, Loader2, Video, MessageCircle, ShieldAlert, Shield } from "lucide-react";
import { fetchScoreSnapshots, fetchTeamsSentiment, fetchTeamsSentimentCache } from "@/lib/api";
import type { TeamsSentimentResult } from "@/lib/api";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import ImprovementJourneyModal from "@/components/ImprovementJourneyModal";
import type { Manager, Feedback, AISuggestion } from "@/lib/api";
import { extendedMetricLabels } from "@/lib/metricLabels";

interface OverviewTabProps {
  manager: Manager;
  feedbacks: Feedback[];
  sentimentTrend?: SentimentTrend | null;
  suggestions?: AISuggestion[];
  sugsLoading?: boolean;
  sugsError?: string | null;
  onGenerateSuggestions?: () => void;
}

const breakdownLabels: Record<string, string> = {
  employeePerformance: "Employee Performance",
  feedbackSentiment: "Feedback Sentiment",
  kpiMetrics: "KPI Metrics",
  teamRetention: "Team Retention",
  goalCompletion: "Goal Completion",
  employeePromotion: "Employee Promotion",
  subordinate360: "360° Subordinate Rating",
  engagement: "Engagement",
  idpScore: "IDP (Dev Goals)",
};

type RadarSourceDefinition = {
  subject: string;
  fallback: number | undefined;
  feedbackRatingKeys: string[];
  feedbackKeywords: string[];
  teamsKeywords: string[];
  includeOverallFeedback?: boolean;
  includeOverallTeams?: boolean;
  teamsRetentionMode?: boolean;
};

type SourceRadarPoint = {
  subject: string;
  value: number;
  continuous?: number;
  teams?: number;
};

function clampScore(value: number | undefined | null): number | undefined {
  if (value == null || Number.isNaN(Number(value))) return undefined;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function averageScore(values: Array<number | undefined>): number | undefined {
  const validValues = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (validValues.length === 0) return undefined;
  return clampScore(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function textMatches(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const normalizedText = text.toLowerCase();
  return keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()));
}

function scoreFromFeedback(feedbacks: Feedback[], definition: RadarSourceDefinition): number | undefined {
  if (feedbacks.length === 0) return undefined;

  const ratingScores = feedbacks.flatMap((feedback) =>
    definition.feedbackRatingKeys
      .map((key) => feedback.ratings?.[key as keyof NonNullable<Feedback["ratings"]>])
      .filter((value): value is number => typeof value === "number" && value > 0)
      .map((value) => value * 20)
  );

  const keywordScores = feedbacks
    .filter((feedback) =>
      textMatches(`${feedback.feedbackCategory || ""} ${feedback.feedbackType || ""} ${feedback.comment || ""}`, definition.feedbackKeywords)
    )
    .map((feedback) => (feedback.compositeFeedbackScore ?? feedback.sentimentScore ?? 0.5) * 100);

  const overallFeedbackScore = definition.includeOverallFeedback
    ? averageScore(feedbacks.map((feedback) => (feedback.compositeFeedbackScore ?? feedback.sentimentScore ?? 0.5) * 100))
    : undefined;

  return averageScore([...ratingScores, ...keywordScores, overallFeedbackScore]);
}

function scoreFromTeams(teamsSentiment: TeamsSentimentResult | null, definition: RadarSourceDefinition): number | undefined {
  const employees = teamsSentiment?.employees || [];
  if (employees.length === 0) return undefined;

  if (definition.teamsRetentionMode) {
    return averageScore(
      employees.map((employee) => {
        const sentimentScore = employee.overallSentiment * 100;
        return employee.riskFlag ? Math.min(sentimentScore, 35) : sentimentScore;
      })
    );
  }

  const matchedScores = employees
    .filter((employee) =>
      textMatches(
        [
          employee.emotionalState,
          ...(employee.keyThemes || []),
          employee.topConcern || "",
          employee.positiveSignal || "",
          employee.summary || "",
        ].join(" "),
        definition.teamsKeywords
      )
    )
    .map((employee) => employee.overallSentiment * 100);

  const overallTeamsScore = definition.includeOverallTeams
    ? teamsSentiment.teamSentiment * 100
    : undefined;

  return averageScore([...matchedScores, overallTeamsScore]);
}

function buildRadarData(
  definitions: RadarSourceDefinition[],
  feedbacks: Feedback[],
  teamsSentiment: TeamsSentimentResult | null
): SourceRadarPoint[] {
  return definitions.map((definition) => {
    const continuous = scoreFromFeedback(feedbacks, definition);
    const teams = scoreFromTeams(teamsSentiment, definition);
    const fallback = clampScore(definition.fallback) ?? 70;

    return {
      subject: definition.subject,
      continuous,
      teams,
      value: averageScore([continuous, teams]) ?? fallback,
    };
  });
}

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const OverviewTab = ({ manager, feedbacks, sentimentTrend, suggestions, sugsLoading, sugsError, onGenerateSuggestions }: OverviewTabProps) => {
  const [journeyOpen, setJourneyOpen] = React.useState(false);
  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [scoreTrendOpen, setScoreTrendOpen] = React.useState(false);
  const [trendChange, setTrendChange] = React.useState<{ direction: "up" | "down" | "neutral"; change: number } | null>(null);
  const [teamsSentiment, setTeamsSentiment] = React.useState<TeamsSentimentResult | null>(null);
  const [teamsLoading, setTeamsLoading] = React.useState(false);
  const [teamsError, setTeamsError] = React.useState<string | null>(null);

  // Load cached Teams sentiment on mount or auto-analyze if missing
  React.useEffect(() => {
    if (!manager._id) return;

    setTeamsLoading(true);
    fetchTeamsSentimentCache(manager._id)
      .then(async (cached) => {
        if (cached) {
          setTeamsSentiment(cached);
          setTeamsLoading(false);
        } else {
          // Auto-analyze if no cache exists
          try {
            const result = await fetchTeamsSentiment(manager._id);
            setTeamsSentiment(result);
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } }; message?: string };
            setTeamsError(error.response?.data?.message || error.message || "Analysis failed");
          } finally {
            setTeamsLoading(false);
          }
        }
      })
      .catch(() => {
        setTeamsLoading(false);
      });
  }, [manager._id]);

  React.useEffect(() => {
    if (!manager._id) return;
    fetchScoreSnapshots(manager._id, 12)
      .then((snaps) => {
        if (snaps.length < 2) {
          setTrendChange(null);
          return;
        }
        const first = snaps[0].finalScore;
        const last = snaps[snaps.length - 1].finalScore;
        const change = last - first;
        setTrendChange({
          direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
          change,
        });
      })
      .catch(() => setTrendChange(null));
  }, [manager._id]);

  const [fbFilter, setFbFilter] = React.useState<"all" | "positive" | "neutral" | "negative">("all");

  const kpiMetrics = manager.extendedMetrics
    ? Object.entries(manager.extendedMetrics).filter(([key]) => extendedMetricLabels[key] !== undefined)
    : [];

  const positiveFb = feedbacks.filter(f => f.sentimentScore >= 0.6);
  const neutralFb = feedbacks.filter(f => f.sentimentScore > 0.4 && f.sentimentScore < 0.6);
  const negativeFb = feedbacks.filter(f => f.sentimentScore <= 0.4);
  const filteredFb = fbFilter === "all" ? feedbacks : fbFilter === "positive" ? positiveFb : fbFilter === "neutral" ? neutralFb : negativeFb;

  const fbChips = [
    { key: "all" as const, label: "All", count: feedbacks.length, color: "bg-primary/10 text-primary border-primary/20", active: "bg-primary text-white" },
    { key: "positive" as const, label: "Positive", count: positiveFb.length, color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", active: "bg-emerald-500 text-white" },
    { key: "neutral" as const, label: "Neutral", count: neutralFb.length, color: "bg-amber-500/10 text-amber-700 border-amber-500/20", active: "bg-amber-500 text-white" },
    { key: "negative" as const, label: "Negative", count: negativeFb.length, color: "bg-red-500/10 text-red-700 border-red-500/20", active: "bg-red-500 text-white" },
  ];

  const categoryLabels: Record<string, string> = {
    communication: "💬 Communication",
    leadership: "👑 Leadership",
    culture: "🌱 Culture",
    growth: "📈 Growth",
    worklife: "⚖️ Work-Life Balance",
    technical: "⚙️ Technical",
    General: "📋 General",
  };

  const competencyRadarData = React.useMemo(
    () =>
      buildRadarData(
        [
          {
            subject: "Communication",
            fallback: manager.aiBreakdown?.feedbackSentiment || Math.round(manager.sentimentScore * 90),
            feedbackRatingKeys: ["communication", "availability"],
            feedbackKeywords: ["communication", "feedback", "1:1", "one-on-one", "visibility", "clear", "meeting"],
            teamsKeywords: ["communication", "clear", "visibility", "meeting", "spec", "feedback", "disconnected"],
            includeOverallFeedback: true,
            includeOverallTeams: true,
          },
          {
            subject: "Execution",
            fallback: manager.aiBreakdown?.goalCompletion || manager.aiBreakdown?.kpiMetrics || 70,
            feedbackRatingKeys: ["decisionMaking", "conflictResolution"],
            feedbackKeywords: ["execution", "delivery", "deadline", "blocked", "process", "resolution", "response"],
            teamsKeywords: ["deadline", "blocked", "process", "delivery", "testing", "bottleneck", "escalate"],
          },
          {
            subject: "Empathy",
            fallback: manager.aiBreakdown?.engagement || Math.round(manager.sentimentScore * 80),
            feedbackRatingKeys: ["recognition", "fairness", "availability"],
            feedbackKeywords: ["support", "recognition", "fairness", "workload", "stress", "help", "heard"],
            teamsKeywords: ["support", "workload", "stress", "frustrated", "anxious", "help", "heard", "focus time"],
            includeOverallFeedback: true,
            includeOverallTeams: true,
          },
          {
            subject: "Development",
            fallback: manager.aiBreakdown?.idpScore || manager.aiBreakdown?.employeePromotion || 65,
            feedbackRatingKeys: ["careerGrowth", "empowerment"],
            feedbackKeywords: ["growth", "career", "learning", "promotion", "development", "empowerment", "lead role"],
            teamsKeywords: ["growth", "career", "learn", "promotion", "lead role", "visibility", "walkthrough"],
          },
          {
            subject: "Retention",
            fallback: manager.aiBreakdown?.teamRetention || 80,
            feedbackRatingKeys: ["fairness", "recognition"],
            feedbackKeywords: ["retention", "attrition", "leave", "future", "burnout", "stuck", "stress"],
            teamsKeywords: ["future", "leave", "stuck", "burnout", "exhausting", "demoralizing", "risk"],
            includeOverallFeedback: true,
            teamsRetentionMode: true,
          },
          {
            subject: "Leadership",
            fallback: manager.aiBreakdown?.subordinate360 || manager.aiBreakdown?.employeePerformance || 75,
            feedbackRatingKeys: ["decisionMaking", "conflictResolution", "fairness", "recognition"],
            feedbackKeywords: ["leadership", "decision", "conflict", "ownership", "direction", "manager", "escalation"],
            teamsKeywords: ["leadership", "decision", "escalate", "direction", "ownership", "manager", "lead"],
            includeOverallFeedback: true,
          },
        ],
        feedbacks,
        teamsSentiment
      ),
    [feedbacks, manager.aiBreakdown, manager.sentimentScore, teamsSentiment]
  );

  const skillRadarData = React.useMemo(
    () =>
      buildRadarData(
        [
          {
            subject: "KPI Delivery",
            fallback: manager.aiBreakdown?.kpiMetrics || 70,
            feedbackRatingKeys: ["decisionMaking"],
            feedbackKeywords: ["kpi", "delivery", "performance", "metric", "result", "target", "deadline"],
            teamsKeywords: ["delivered", "deadline", "target", "dashboard", "report", "saving", "result"],
          },
          {
            subject: "Goal Setting",
            fallback: manager.aiBreakdown?.goalCompletion || 65,
            feedbackRatingKeys: ["communication", "decisionMaking"],
            feedbackKeywords: ["goal", "priority", "requirement", "spec", "planning", "clarity"],
            teamsKeywords: ["goal", "priority", "requirement", "spec", "planning", "clearer", "roadmap"],
          },
          {
            subject: "Team Building",
            fallback: manager.aiBreakdown?.teamRetention || 80,
            feedbackRatingKeys: ["recognition", "fairness", "availability"],
            feedbackKeywords: ["team", "collaboration", "culture", "bonding", "support", "connect"],
            teamsKeywords: ["team", "collaboration", "lunch", "bonding", "connect", "disconnected", "working with people"],
            includeOverallTeams: true,
          },
          {
            subject: "Talent Growth",
            fallback: manager.aiBreakdown?.employeePromotion || manager.aiBreakdown?.idpScore || 60,
            feedbackRatingKeys: ["careerGrowth", "empowerment"],
            feedbackKeywords: ["growth", "career", "development", "learning", "promotion", "skill"],
            teamsKeywords: ["growth", "career", "learn", "walkthrough", "lead role", "future", "visibility"],
          },
          {
            subject: "Engagement",
            fallback: manager.aiBreakdown?.engagement || 72,
            feedbackRatingKeys: ["recognition", "availability", "fairness"],
            feedbackKeywords: ["engagement", "motivation", "happy", "thriving", "stressed", "culture", "mood"],
            teamsKeywords: ["engaged", "motivated", "proud", "excited", "frustrated", "disengaged", "anxious"],
            includeOverallFeedback: true,
            includeOverallTeams: true,
          },
          {
            subject: "Performance Mgmt",
            fallback: manager.aiBreakdown?.employeePerformance || 68,
            feedbackRatingKeys: ["decisionMaking", "conflictResolution", "communication"],
            feedbackKeywords: ["performance", "feedback", "blocker", "issue", "triage", "resolution", "improvement"],
            teamsKeywords: ["blocked", "issue", "improvement", "escalate", "concern", "progressing", "testing"],
          },
        ],
        feedbacks,
        teamsSentiment
      ),
    [feedbacks, manager.aiBreakdown, teamsSentiment]
  );

  const radarSourceSummary = `${feedbacks.length} continuous feedback record${feedbacks.length === 1 ? "" : "s"} • ${teamsSentiment?.employeesAnalyzed || 0} Teams profile${teamsSentiment?.employeesAnalyzed === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      {/* Gauges with embedded stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
        {/* Manager Effectiveness Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-lg p-6 flex flex-col items-center"
        >
          <ScoreGauge
            label="Manager Effectiveness Score"
            value={manager.effectivenessScore}
            max={100}
            color="primary"
            bare
          />

          {/* Trend Change Badge */}
          {trendChange && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className={`mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${trendChange.direction === "up"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : trendChange.direction === "down"
                  ? "bg-red-500/10 border-red-500/20 text-red-500"
                  : "bg-secondary border-border text-muted-foreground"
                }`}
            >
              {trendChange.direction === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : trendChange.direction === "down" ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {trendChange.change > 0 ? "+" : ""}{trendChange.change} Change
            </motion.div>
          )}

          <div className="w-full mt-4 pt-4 border-t border-border/30 flex items-center justify-center gap-2">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">Total Employees</span>
              <span className="text-sm font-display font-bold text-foreground leading-tight">{manager.totalEmployees}</span>
            </div>
          </div>

          {/* KPI Breakdown detail modal trigger */}
          {kpiMetrics.length > 0 && (
            <button
              onClick={() => setKpiOpen(true)}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-bold hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 transition-all duration-200"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              View Details
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button>
          )}

          {/* Score Trend button */}
          <button
            onClick={() => setScoreTrendOpen(true)}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors text-indigo-600 text-[11px] font-bold"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Score Trend
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </button>
        </motion.div>

        {/* Sentiment Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-card rounded-lg p-6 flex flex-col items-center"
        >
          <ScoreGauge
            label="Sentiment Score"
            value={Math.round(manager.sentimentScore * 100)}
            max={100}
            suffix="%"
            color={manager.sentimentScore > 0.6 ? "success" : manager.sentimentScore < 0.4 ? "destructive" : "accent"}
            bare
          />
          <div className={`mt-1 text-lg font-display font-bold ${manager.sentimentLabel === "Positive" ? "text-success"
            : manager.sentimentLabel === "Negative" ? "text-destructive"
              : "text-accent"
            }`}>
            {manager.sentimentLabel}
          </div>

          {/* Month-over-Month Sentiment Trend */}
          {sentimentTrend && sentimentTrend.delta != null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 flex items-center gap-1.5"
            >
              {sentimentTrend.direction === "up" ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-500">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" /></svg>
                  +{Math.round(sentimentTrend.delta * 100)}%
                </span>
              ) : sentimentTrend.direction === "down" ? (
                <span className="flex items-center gap-1 text-xs font-bold text-red-500">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" /></svg>
                  {Math.round(sentimentTrend.delta * 100)}%
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  — 0%
                </span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium">vs {sentimentTrend.previousMonth.label || "last month"}</span>
            </motion.div>
          )}

          {/* Feedback chips + View Details inside Sentiment card */}
          {feedbacks.length > 0 && (
            <div className="w-full mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <span className="text-xs font-bold text-foreground">Team Feedback</span>
                  <span className="text-[10px] text-muted-foreground font-medium">({feedbacks.length})</span>
                </div>
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105 transition-all duration-200 flex items-center gap-1.5"
                >
                  View Details
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fbChips.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setFbFilter(chip.key)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${fbFilter === chip.key ? chip.active + " border-transparent shadow-sm" : chip.color
                      }`}
                  >
                    {chip.label}
                    <span className={`tabular-nums ${fbFilter === chip.key ? "opacity-80" : "opacity-60"}`}>{chip.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {feedbacks.length === 0 && (
            <div className="w-full mt-4 pt-4 border-t border-border/30 flex items-center justify-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent shrink-0" />
              <span className="text-xs text-muted-foreground italic">No feedback received yet</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Radar Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competency Radar (Blue) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-lg p-6"
        >
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Competency Radar</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Combined view from Teams Feedback and registered Continuous Feedback.
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">{radarSourceSummary}{teamsLoading ? " • Teams analyzing" : ""}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart
              data={competencyRadarData}
              cx="50%" cy="50%" outerRadius="70%"
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => [`${Math.round(Number(value))}/100`, name]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Radar name="Continuous Feedback" dataKey="continuous" stroke="#2563eb" fill="#2563eb" fillOpacity={0.04} strokeWidth={1.5} strokeDasharray="4 4" />
              <Radar name="Teams Feedback" dataKey="teams" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.04} strokeWidth={1.5} strokeDasharray="3 3" />
              <Radar name="Combined" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Skill Radar (Orange) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-lg p-6"
        >
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Skill Radar</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Skills are mapped from Teams Feedback and calibrated with submitted feedback ratings.
            </p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">{radarSourceSummary}{teamsLoading ? " • Teams analyzing" : ""}</p>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart
              data={skillRadarData}
              cx="50%" cy="50%" outerRadius="70%"
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                formatter={(value, name) => [`${Math.round(Number(value))}/100`, name]}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Radar name="Continuous Feedback" dataKey="continuous" stroke="#2563eb" fill="#2563eb" fillOpacity={0.04} strokeWidth={1.5} strokeDasharray="4 4" />
              <Radar name="Teams Feedback" dataKey="teams" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.04} strokeWidth={1.5} strokeDasharray="3 3" />
              <Radar name="Combined" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.18} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── AI Analysis Detailed Section ── */}
      {(manager.aiReasoning || manager.aiBreakdown) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-xl p-6 border border-primary/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">Performance Insights</h3>
              <p className="text-xs text-muted-foreground">Analysis based on 9 data dimensions</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Reasoning */}
            {manager.aiReasoning && (
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Analysis Reasoning</p>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">{manager.aiReasoning}</p>
              </div>
            )}

            {/* Strengths & Weaknesses — derived from 9 KPI breakdown metrics */}
            {manager.aiBreakdown && (() => {
              const entries = Object.entries(manager.aiBreakdown)
                .filter(([key]) => breakdownLabels[key] !== undefined)
                .sort(([, a], [, b]) => b - a);

              const strengths = entries.slice(0, 3);
              const weaknesses = entries.slice(-3).reverse();

              const strengthNames = strengths.map(([k]) => breakdownLabels[k]);
              const weaknessNames = weaknesses.map(([k]) => breakdownLabels[k]);
              const strengthAvg = Math.round(strengths.reduce((s, [, v]) => s + v, 0) / strengths.length);
              const weaknessAvg = Math.round(weaknesses.reduce((s, [, v]) => s + v, 0) / weaknesses.length);

              const strengthSummary = `Excelling in ${strengthNames.join(", ")} with an average score of ${strengthAvg}/100, indicating strong managerial capabilities in these areas.`;
              const weaknessSummary = `${weaknessNames.join(", ")} are lagging at an average of ${weaknessAvg}/100 and need focused attention to improve overall effectiveness.`;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {strengths.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" /> Core Strengths
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {strengths.map(([key, value]) => (
                          <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] font-bold text-emerald-700 tabular-nums">{value}</span>
                            <span className="text-[10px] font-bold text-emerald-800">{breakdownLabels[key]}</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic">{strengthSummary}</p>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                          <Brain className="h-3 w-3" /> Areas for Improvement
                        </p>
                        <button
                          onClick={() => setJourneyOpen(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] font-bold hover:opacity-90 transition-opacity shadow-sm"
                        >
                          <Sparkles className="h-3 w-3" />
                          <Rocket className="h-3 w-3" />
                          Improvement Journey
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {weaknesses.map(([key, value]) => (
                          <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                            <span className="text-[10px] font-bold text-red-700 tabular-nums">{value}</span>
                            <span className="text-[10px] font-bold text-red-800">{breakdownLabels[key]}</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed italic">{weaknessSummary}</p>
                    </div>
                  )}
                </div>
              );
            })()}


          </div>
        </motion.div>
      )
      }

      {/* Score Trend Side Modal */}
      {scoreTrendOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScoreTrendOpen(false)} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-3xl bg-background border-l border-border shadow-2xl overflow-y-auto flex flex-col"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Score Trend</h3>
              </div>
              <button onClick={() => setScoreTrendOpen(false)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4">
              <ScoreTrendChart
                managerId={manager._id}
                currentScore={manager.effectivenessScore}
                showPeerComparison
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* KPI Breakdown Side Modal */}
      {kpiOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setKpiOpen(false)} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto flex flex-col"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-display text-lg font-semibold">KPI Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Manager Effectiveness input dimensions</p>
                </div>
              </div>
              <button onClick={() => setKpiOpen(false)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              {kpiMetrics.map(([key, value], i) => {
                const isIDP = key === "IDP";
                const displayValue = isIDP ? `${value} emp` : `${value}%`;
                const barWidth = isIDP ? Math.min(100, (Number(value) / 5) * 100) : Number(value);
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="p-4 rounded-xl bg-card border border-border"
                  >
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <span className="text-sm font-medium text-foreground">{extendedMetricLabels[key]}</span>
                      <span className={`text-sm font-bold ${barWidth >= 80 ? 'text-emerald-500' : barWidth >= 60 ? 'text-primary' : 'text-destructive'}`}>{displayValue}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                        className={`h-full rounded-full ${barWidth >= 80 ? 'bg-emerald-500' : barWidth >= 60 ? 'bg-primary' : 'bg-destructive'}`}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Feedback Side Modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setFeedbackOpen(false)} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-background border-l border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 space-y-3 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-lg font-semibold">Feedbacks</h3>
                  <span className="text-xs text-muted-foreground">({filteredFb.length})</span>
                </div>
                <button onClick={() => setFeedbackOpen(false)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {fbChips.map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setFbFilter(chip.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${fbFilter === chip.key ? chip.active + " border-transparent shadow-sm" : chip.color
                      }`}
                  >
                    {chip.label} {chip.count}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical 70/30 Split Body */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Top: Employee Feedbacks (70%) */}
              <div className="h-[50%] overflow-y-auto p-4 space-y-4 border-b border-border/40">
                {filteredFb.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">No {fbFilter} feedbacks found.</p>
                ) : (() => {
                  const grouped = filteredFb.reduce<Record<string, typeof filteredFb>>((acc, fb) => {
                    const cat = fb.feedbackCategory || "General";
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(fb);
                    return acc;
                  }, {});
                  return Object.entries(grouped)
                    .sort(([, a], [, b]) => b.length - a.length)
                    .map(([category, items]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/30">
                          <span className="text-xs font-bold text-foreground uppercase tracking-wider">{categoryLabels[category] || category}</span>
                          <span className="text-[10px] font-bold text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded-full tabular-nums">{items.length}</span>
                        </div>
                        <div className="space-y-2.5">
                          {items.map((fb) => (
                            <div key={fb.id} className="flex flex-col gap-2 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  {fb.pulseMood && (<span className="text-xs">{fb.pulseMood === "thriving" ? "🔥" : fb.pulseMood === "happy" ? "😊" : fb.pulseMood === "neutral" ? "😐" : fb.pulseMood === "stressed" ? "😓" : "😞"}</span>)}
                                </div>
                                <div className="flex items-center gap-2">
                                  {fb.compositeFeedbackScore != null && (<span className="text-[10px] font-bold text-primary/80">Score: {Math.round(fb.compositeFeedbackScore * 100)}%</span>)}
                                  <time className="text-[10px] tabular-nums font-medium text-muted-foreground/50">{new Date(fb.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
                                </div>
                              </div>
                              <p className="text-sm text-foreground/90 font-medium italic">"{fb.comment}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                })()}
              </div>

              {/* Bottom: Teams Transcript Feedback (30%) */}
              <div className="h-[50%] overflow-y-auto p-4 bg-gradient-to-b from-indigo-500/[0.03] to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-sm font-bold text-foreground">Teams Feedback</h4>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground mb-3">Sentiment from meeting transcripts & chats</p>

                {/* Loading */}
                {teamsLoading && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    <p className="text-[10px] text-muted-foreground">Analyzing transcripts...</p>
                  </div>
                )}

                {/* Error */}
                {teamsError && !teamsLoading && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                    <p className="text-xs text-destructive font-medium">{teamsError}</p>
                  </div>
                )}

                {/* Empty state */}
                {!teamsSentiment && !teamsLoading && !teamsError && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 border border-dashed border-border/60 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-muted-foreground/30" />
                      <MessageCircle className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center px-2">Auto-analyzing employee sentiment from Teams data...</p>
                  </div>
                )}

                {/* Results */}
                {teamsSentiment && !teamsLoading && (
                  <div className="space-y-3">
                    {/* Team summary */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${teamsSentiment.teamSentimentLabel === "Positive" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                        teamsSentiment.teamSentimentLabel === "Negative" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                          "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}>
                        {(teamsSentiment.teamSentiment * 100).toFixed(0)}% Team
                      </div>
                      {teamsSentiment.riskCount > 0 ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                          <ShieldAlert className="h-3 w-3 text-red-500" />
                          <span className="text-[10px] font-bold text-red-600">{teamsSentiment.riskCount} risk</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <Shield className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600">No risks</span>
                        </div>
                      )}
                    </div>

                    {/* Per-employee cards */}
                    {teamsSentiment.employees.map((emp, i) => {
                      const sentColor = emp.sentimentLabel === "Positive" ? "text-emerald-500" : emp.sentimentLabel === "Negative" ? "text-red-500" : "text-amber-500";
                      return (
                        <motion.div
                          key={emp.employeeName}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className={`p-3.5 rounded-xl border transition-all duration-300 hover:scale-[1.01] ${emp.riskFlag
                            ? "border-red-500/40 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.08)]"
                            : i % 2 === 0
                              ? "border-indigo-500/30 bg-indigo-500/[0.04] shadow-[0_0_12px_rgba(99,102,241,0.06)]"
                              : "border-purple-500/30 bg-purple-500/[0.04] shadow-[0_0_12px_rgba(168,85,247,0.06)]"
                            }`}
                        >
                          {/* Name & score */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                                {emp.employeeName.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{emp.employeeName}</p>
                                <p className="text-[9px] text-muted-foreground">{emp.role}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-bold ${sentColor}`}>
                              {(emp.overallSentiment * 100).toFixed(0)}%
                            </span>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/80 border border-border font-medium text-foreground">
                              {emp.emotionalState}
                            </span>
                            {emp.riskFlag && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 font-bold border border-red-500/20">⚠ Risk</span>
                            )}
                            <span className="text-[9px] text-muted-foreground">
                              {emp.meetingCount}m · {emp.chatCount}c
                            </span>
                          </div>

                          {/* AI Summary as quote */}
                          <p className="text-[11px] text-foreground/80 italic leading-relaxed">"{emp.summary}"</p>

                          {/* Key themes */}
                          {emp.keyThemes && emp.keyThemes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {emp.keyThemes.map((theme, ti) => (
                                <span key={ti} className="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/15 text-indigo-700 font-medium">
                                  {theme}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Concern / Positive */}
                          {(emp.topConcern || emp.positiveSignal) && (
                            <div className="mt-2 space-y-1">
                              {emp.topConcern && (
                                <div className="p-1.5 rounded bg-red-500/5 border border-red-500/10">
                                  <p className="text-[8px] font-bold text-red-600 uppercase">Concern</p>
                                  <p className="text-[10px] text-foreground/80">{emp.topConcern}</p>
                                </div>
                              )}
                              {emp.positiveSignal && (
                                <div className="p-1.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                                  <p className="text-[8px] font-bold text-emerald-600 uppercase">Positive</p>
                                  <p className="text-[10px] text-foreground/80">{emp.positiveSignal}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Improvement Journey Modal */}
      <ImprovementJourneyModal
        isOpen={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        manager={manager}
        suggestions={suggestions}
        sugsLoading={sugsLoading}
        sugsError={sugsError}
        onGenerateSuggestions={onGenerateSuggestions}
      />
    </div >
  );
};


export default OverviewTab;
