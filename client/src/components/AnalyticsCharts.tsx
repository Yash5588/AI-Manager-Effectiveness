import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
interface AnalysisData {
  sentimentScore: number;
  effectivenessScore: number;
  sentimentLabel: string;
  suggestions: string[];
  strengths: string[];
  feedbackText: string;
  aiBreakdown?: any;
}

interface AnalyticsChartsProps {
  analysis: AnalysisData;
}

const AnalyticsCharts = ({ analysis }: AnalyticsChartsProps) => {
  const barData = [
    { name: "Sentiment", score: Math.round(analysis.sentimentScore * 100) },
    { name: "Effectiveness", score: analysis.effectivenessScore },
    { name: "Team Growth", score: analysis.aiBreakdown?.employeeGrowth || analysis.aiBreakdown?.trainingDevelopment || 70 },
    { name: "Reliability", score: analysis.aiBreakdown?.projectDelivery || analysis.aiBreakdown?.responsiveness || 75 },
  ];

  const radarData = [
    { subject: "Communication", value: analysis.aiBreakdown?.oneOnOneQuality || analysis.aiBreakdown?.responsiveness || Math.round(analysis.sentimentScore * 90) },
    { subject: "Execution", value: analysis.aiBreakdown?.projectDelivery || analysis.aiBreakdown?.goalCompletion || 70 },
    { subject: "Empathy", value: analysis.aiBreakdown?.feedbackSentiment || analysis.aiBreakdown?.engagement || Math.round(analysis.sentimentScore * 80) },
    { subject: "Development", value: analysis.aiBreakdown?.employeeGrowth || analysis.aiBreakdown?.trainingDevelopment || 65 },
    { subject: "Retention", value: analysis.aiBreakdown?.teamRetention || 80 },
    { subject: "Performance", value: analysis.aiBreakdown?.employeePerformance || analysis.aiBreakdown?.kpiMetrics || 75 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card rounded-lg p-6"
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          Performance Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
            <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card rounded-lg p-6"
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          Competency Radar
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
};

export default AnalyticsCharts;
