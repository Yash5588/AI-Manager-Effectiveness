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
          <div className={`text-2xl font-display font-bold ${
            manager.sentimentLabel === "Positive" ? "text-success"
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
          {feedbacks.slice(0, 4).map((fb) => (
            <div key={fb.id} className="flex items-start gap-3 p-3 rounded-md bg-secondary/50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{fb.employeeName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    fb.sentimentLabel === "Positive" ? "bg-success/15 text-success"
                      : fb.sentimentLabel === "Negative" ? "bg-destructive/15 text-destructive"
                      : "bg-accent/15 text-accent"
                  }`}>{fb.sentimentLabel}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{fb.date}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{fb.text}</p>
              </div>
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
