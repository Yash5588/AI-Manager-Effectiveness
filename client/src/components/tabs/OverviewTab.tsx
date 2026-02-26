import { motion } from "framer-motion";
import { Users, TrendingUp, BarChart3, MessageSquare, Brain, Sparkles } from "lucide-react";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import type { Manager, Feedback, Metric } from "@/lib/api";

interface OverviewTabProps {
  manager: Manager;
  feedbacks: Feedback[];
}

const breakdownLabels: Record<string, string> = {
  employeePerformance: "Employee Performance",
  feedbackSentiment: "Feedback Sentiment",
  kpiMetrics: "KPI Metrics",
  teamRetention: "Team Retention",
  goalCompletion: "Goal Completion",
  oneOnOneQuality: "1-on-1 Quality",
  employeeGrowth: "Employee Growth",
  responsiveness: "Responsiveness",
  peerReview: "Peer Review",
  projectDelivery: "Project Delivery",
  engagement: "Engagement",
  trainingDevelopment: "Training & Dev",
};

const extendedMetricLabels: Record<string, string> = {
  teamRetentionRate: "Team Retention Rate",
  goalCompletionRate: "Goal Completion Rate",
  oneOnOneFrequency: "1-on-1 Meeting Frequency",
  employeeGrowthRate: "Employee Growth Rate",
  responseTimeScore: "Response Time Score",
  peerReviewScore: "360° Peer Review Score",
  projectDeliveryTimeliness: "Project Delivery Timeliness",
  employeeEngagementScore: "Employee Engagement Score",
  trainingInvestment: "Training & Dev Investment",
};

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const OverviewTab = ({ manager, feedbacks }: OverviewTabProps) => {
  const stats = [
    { label: "Total Employees", value: manager.totalEmployees, icon: Users, color: "text-primary" },
    { label: "Avg Sentiment", value: `${(manager.sentimentScore * 100).toFixed(0)}%`, icon: TrendingUp, color: "text-success" },
    { label: "Feedbacks", value: feedbacks.length, icon: MessageSquare, color: "text-accent" },
    { label: "AI Score", value: `${manager.effectivenessScore}%`, icon: Sparkles, color: "text-primary shadow-sm" },
  ];

  const analysis = {
    sentimentScore: manager.sentimentScore,
    effectivenessScore: manager.effectivenessScore,
    sentimentLabel: manager.sentimentLabel,
    suggestions: [],
    strengths: manager.aiStrengths || [],
    feedbackText: "",
    aiBreakdown: manager.aiBreakdown,
  };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-lg p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <ScoreGauge
          label="Sentiment Score"
          value={manager.sentimentScore}
          max={1}
          color={manager.sentimentScore > 0.6 ? "success" : manager.sentimentScore < 0.4 ? "destructive" : "accent"}
        />
        <ScoreGauge
          label="AI Effectiveness Score"
          value={manager.effectivenessScore}
          max={100}
          color="primary"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card rounded-lg p-6 flex flex-col items-center justify-center"
        >
          <div className={`text-2xl font-display font-bold ${manager.sentimentLabel === "Positive" ? "text-success"
            : manager.sentimentLabel === "Negative" ? "text-destructive"
              : "text-accent"
            }`}>
            {manager.sentimentLabel}
          </div>
          <span className="mt-2 text-sm font-medium text-muted-foreground">Overall Sentiment</span>
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
              <h3 className="font-display text-lg font-semibold text-foreground">AI Performance Insights</h3>
              <p className="text-xs text-muted-foreground">Detailed reasoning based on 12 data dimensions</p>
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

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {manager.aiStrengths && manager.aiStrengths.length > 0 && (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> Core Strengths
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {manager.aiStrengths.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 text-[10px] font-bold border border-emerald-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {manager.aiWeaknesses && manager.aiWeaknesses.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Brain className="h-3 w-3" /> Areas for Improvement
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {manager.aiWeaknesses.map((w, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-700 text-[10px] font-bold border border-red-500/20">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 12-Dimension Breakdown */}
            {manager.aiBreakdown && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Holistic Breakdown</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {Object.entries(manager.aiBreakdown)
                    .filter(([key]) => breakdownLabels[key] !== undefined)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-muted-foreground w-36 shrink-0 truncate">{breakdownLabels[key] || key}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${value}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className={`h-full rounded-full ${getBarColor(value)}`}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-foreground w-8 text-right">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Score Trend Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreTrendChart
          managerId={manager._id}
          currentScore={manager.effectivenessScore}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-lg p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-semibold text-foreground">KPI Metrics Breakdown</h3>
          </div>
          <div className="space-y-4">
            {manager.extendedMetrics && Object.entries(manager.extendedMetrics)
              .filter(([key]) => extendedMetricLabels[key] !== undefined)
              .map(([key, value], i) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">{extendedMetricLabels[key] || key}</span>
                    <span className="text-foreground">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                      className={`h-full rounded-full ${Number(value) >= 80 ? 'bg-emerald-500' : Number(value) >= 60 ? 'bg-primary' : 'bg-destructive'}`}
                    />
                  </div>
                </div>
              ))}
            {(!manager.extendedMetrics || Object.keys(manager.extendedMetrics).filter(k => extendedMetricLabels[k]).length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8 italic">No specific KPI metrics available.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Feedbacks */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-lg p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="h-5 w-5 text-accent" />
          <h3 className="font-display text-lg font-semibold text-foreground">Recent Team Feedback</h3>
        </div>
        <div className="space-y-3">
          {feedbacks.slice(0, 8).map((fb) => (
            <div key={fb.id} className="group flex flex-col gap-2 p-3.5 rounded-xl bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border/50 transition-all">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border border-border/50 ${fb.sentimentLabel === "Positive" ? "text-success"
                    : fb.sentimentLabel === "Negative" ? "text-destructive"
                      : "text-accent"
                    }`}>
                    {fb.sentimentLabel}
                  </span>
                  {fb.feedbackCategory && (
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase opacity-70">
                      {fb.feedbackCategory}
                    </span>
                  )}
                  {fb.pulseMood && (
                    <span className="text-xs">
                      {fb.pulseMood === "thriving" ? "🔥" : fb.pulseMood === "happy" ? "😊" : fb.pulseMood === "neutral" ? "😐" : fb.pulseMood === "stressed" ? "😓" : "😞"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {fb.compositeFeedbackScore != null && (
                    <span className="text-[10px] font-bold text-primary/80">
                      Score: {Math.round(fb.compositeFeedbackScore * 100)}%
                    </span>
                  )}
                  <time className="text-[10px] tabular-nums font-medium text-muted-foreground/50">
                    {new Date(fb.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </time>
                </div>
              </div>
              <p className="text-sm text-foreground/90 font-medium line-clamp-2 italic">
                "{fb.comment}"
              </p>
            </div>
          ))}
          {feedbacks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 italic">No feedback received yet.</p>
          )}
        </div>
      </motion.div>

      {/* Charts */}
      <AnalyticsCharts analysis={analysis} />
    </div>
  );
};

export default OverviewTab;
