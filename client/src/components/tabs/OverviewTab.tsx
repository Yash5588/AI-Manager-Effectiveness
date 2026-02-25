import { motion } from "framer-motion";
import { Users, TrendingUp, BarChart3, MessageSquare } from "lucide-react";
import ScoreGauge from "@/components/ScoreGauge";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import type { Manager, Feedback } from "@/lib/api";

interface OverviewTabProps {
  manager: Manager;
  feedbacks: Feedback[];
}

const OverviewTab = ({ manager, feedbacks }: OverviewTabProps) => {
  const stats = [
    { label: "Total Employees", value: manager.totalEmployees, icon: Users, color: "text-primary" },
    { label: "Avg Sentiment", value: `${(manager.sentimentScore * 100).toFixed(0)}%`, icon: TrendingUp, color: "text-success" },
    { label: "Feedbacks", value: feedbacks.length, icon: MessageSquare, color: "text-accent" },
    { label: "Effectiveness", value: `${manager.effectivenessScore}%`, icon: BarChart3, color: "text-primary" },
  ];

  const analysis = {
    sentimentScore: manager.sentimentScore,
    effectivenessScore: manager.effectivenessScore,
    sentimentLabel: manager.sentimentLabel,
    suggestions: [],
    strengths: [],
    feedbackText: "",
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
          label="Effectiveness Score"
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

      {/* Recent Feedbacks */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-lg p-6"
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Recent Feedbacks</h3>
        <div className="space-y-3">
          {feedbacks.slice(0, 8).map((fb) => (
            <div key={fb.id} className="group flex items-center justify-between gap-4 p-3.5 rounded-xl bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border/50 transition-all">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className={`shrink-0 text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-lg border ${fb.sentimentLabel === "Positive" ? "bg-success/10 text-success border-success/20"
                    : fb.sentimentLabel === "Negative" ? "bg-destructive/10 text-destructive border-destructive/20"
                      : "bg-accent/10 text-accent border-accent/20"
                  }`}>
                  {fb.sentimentLabel}
                </span>
                <p className="text-sm text-foreground/90 font-medium truncate leading-none">
                  {fb.text}
                </p>
              </div>
              <time className="text-[10px] tabular-nums font-medium text-muted-foreground/50">
                {new Date(fb.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </time>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <AnalyticsCharts analysis={analysis} />
    </div>
  );
};

export default OverviewTab;
