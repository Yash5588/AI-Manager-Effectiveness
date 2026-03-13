import React from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, BarChart3, MessageSquare, Brain, Sparkles, Rocket } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import ImprovementJourneyModal from "@/components/ImprovementJourneyModal";
import type { Manager, Feedback } from "@/lib/api";
import { extendedMetricLabels } from "@/lib/metricLabels";

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
  employeePromotion: "Employee Promotion",
  subordinate360: "360° Subordinate Rating",
  engagement: "Engagement",
  idpScore: "IDP (Dev Goals)",
};

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 60) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

const OverviewTab = ({ manager, feedbacks }: OverviewTabProps) => {
  const [journeyOpen, setJourneyOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Gauges with embedded stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Sentiment Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-lg p-6 flex flex-col items-center"
        >
          <ScoreGauge
            label="Sentiment Score"
            value={manager.sentimentScore}
            max={1}
            color={manager.sentimentScore > 0.6 ? "success" : manager.sentimentScore < 0.4 ? "destructive" : "accent"}
            bare
          />
          <div className={`mt-1 text-lg font-display font-bold ${manager.sentimentLabel === "Positive" ? "text-success"
            : manager.sentimentLabel === "Negative" ? "text-destructive"
              : "text-accent"
            }`}>
            {manager.sentimentLabel}
          </div>
          <div className="w-full mt-4 pt-4 border-t border-border/30 flex items-center justify-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">Feedbacks</span>
              <span className="text-sm font-display font-bold text-foreground leading-tight">{feedbacks.length}</span>
            </div>
          </div>
        </motion.div>

        {/* Manager Effectiveness Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-card rounded-lg p-6 flex flex-col items-center"
        >
          <ScoreGauge
            label="Manager Effectiveness Score"
            value={manager.effectivenessScore}
            max={100}
            color="primary"
            bare
          />
          <div className="w-full mt-4 pt-4 border-t border-border/30 flex items-center justify-center gap-2">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">Total Employees</span>
              <span className="text-sm font-display font-bold text-foreground leading-tight">{manager.totalEmployees}</span>
            </div>
          </div>
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
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">Competency Radar</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart
              data={[
                { subject: "Communication", value: manager.aiBreakdown?.feedbackSentiment || Math.round(manager.sentimentScore * 90) },
                { subject: "Execution", value: manager.aiBreakdown?.goalCompletion || manager.aiBreakdown?.kpiMetrics || 70 },
                { subject: "Empathy", value: manager.aiBreakdown?.engagement || Math.round(manager.sentimentScore * 80) },
                { subject: "Development", value: manager.aiBreakdown?.idpScore || manager.aiBreakdown?.employeePromotion || 65 },
                { subject: "Retention", value: manager.aiBreakdown?.teamRetention || 80 },
                { subject: "Leadership", value: manager.aiBreakdown?.subordinate360 || manager.aiBreakdown?.employeePerformance || 75 },
              ]}
              cx="50%" cy="50%" outerRadius="70%"
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
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
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">Skill Radar</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart
              data={[
                { subject: "KPI Delivery", value: manager.aiBreakdown?.kpiMetrics || 70 },
                { subject: "Goal Setting", value: manager.aiBreakdown?.goalCompletion || 65 },
                { subject: "Team Building", value: manager.aiBreakdown?.teamRetention || 80 },
                { subject: "Talent Growth", value: manager.aiBreakdown?.employeePromotion || 60 },
                { subject: "Engagement", value: manager.aiBreakdown?.engagement || 72 },
                { subject: "Performance Mgmt", value: manager.aiBreakdown?.employeePerformance || 68 },
              ]}
              cx="50%" cy="50%" outerRadius="70%"
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} strokeWidth={2} />
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-2">
                      <Brain className="h-3 w-3" /> Areas for Improvement
                    </p>
                    <button
                      onClick={() => setJourneyOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] font-bold hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Rocket className="h-3 w-3" />
                      Improvement Journey
                    </button>
                  </div>
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
      <ScoreTrendChart
        managerId={manager._id}
        currentScore={manager.effectivenessScore}
        showPeerComparison
      />

      {/* KPI + Feedback — compact summary rows */}
      <KPIMetricsCard extendedMetrics={manager.extendedMetrics} />
      <FeedbackSummaryCard feedbacks={feedbacks} />

      {/* Improvement Journey Modal */}
      <ImprovementJourneyModal
        isOpen={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        manager={manager}
      />
    </div>
  );
};

/* ── Feedback Summary Card + Side Modal ── */
const FeedbackSummaryCard = ({ feedbacks }: { feedbacks: Feedback[] }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const positive = feedbacks.filter(f => f.sentimentScore >= 0.6);
  const neutral = feedbacks.filter(f => f.sentimentScore > 0.4 && f.sentimentScore < 0.6);
  const negative = feedbacks.filter(f => f.sentimentScore <= 0.4);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-lg p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-accent" />
            <h3 className="font-display text-lg font-semibold text-foreground">Team Feedback</h3>
            <span className="text-xs text-muted-foreground font-medium">({feedbacks.length})</span>
          </div>
          {feedbacks.length > 0 && (
            <button
              onClick={() => setIsOpen(true)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View Details
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          )}
        </div>

        {feedbacks.length > 0 ? (
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Positive</span>
              <span className="text-sm font-bold text-foreground">{positive.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Neutral</span>
              <span className="text-sm font-bold text-foreground">{neutral.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span className="text-xs font-medium text-muted-foreground">Negative</span>
              <span className="text-sm font-bold text-foreground">{negative.length}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-2 italic">No feedback received yet.</p>
        )}
      </motion.div>

      {/* Side Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-background border-l border-border shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-accent" />
                <h3 className="font-display text-lg font-semibold">Latest Feedbacks</h3>
                <span className="text-xs text-muted-foreground">({feedbacks.length})</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="flex flex-col gap-2 p-3.5 rounded-xl bg-secondary/20 border border-border/30">
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
                  <p className="text-sm text-foreground/90 font-medium italic">
                    "{fb.comment}"
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};
/* ── KPI Metrics Card + Side Modal ── */
const KPIMetricsCard = ({ extendedMetrics }: { extendedMetrics?: Manager["extendedMetrics"] }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const metrics = extendedMetrics
    ? Object.entries(extendedMetrics).filter(([key]) => extendedMetricLabels[key] !== undefined)
    : [];

  // Compute average of percentage metrics (exclude IDP)
  const pctMetrics = metrics.filter(([k]) => k !== "IDP").map(([, v]) => Number(v));
  const avg = pctMetrics.length > 0 ? Math.round(pctMetrics.reduce((s, v) => s + v, 0) / pctMetrics.length) : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-lg px-5 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-semibold text-foreground">KPI Metrics</h3>
            {metrics.length > 0 && (
              <span className={`text-sm font-bold ${avg >= 80 ? 'text-emerald-500' : avg >= 60 ? 'text-primary' : 'text-destructive'}`}>{avg}% avg</span>
            )}
          </div>
          {metrics.length > 0 ? (
            <button
              onClick={() => setIsOpen(true)}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View Details
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          ) : (
            <span className="text-xs text-muted-foreground italic">No data</span>
          )}
        </div>
      </motion.div>

      {/* Side Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-md bg-background border-l border-border shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">KPI Metrics Breakdown</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors"
              >
                <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-4 space-y-5">
              {metrics.map(([key, value], i) => {
                const isIDP = key === "IDP";
                const displayValue = isIDP ? `${value} employees` : `${value}%`;
                const barWidth = isIDP ? Math.min(100, (Number(value) / 5) * 100) : Number(value);
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-foreground">{extendedMetricLabels[key] || key}</span>
                      <span className={`font-bold ${barWidth >= 80 ? 'text-emerald-500' : barWidth >= 60 ? 'text-primary' : 'text-destructive'}`}>{displayValue}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08 }}
                        className={`h-full rounded-full ${barWidth >= 80 ? 'bg-emerald-500' : barWidth >= 60 ? 'bg-primary' : 'bg-destructive'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default OverviewTab;
