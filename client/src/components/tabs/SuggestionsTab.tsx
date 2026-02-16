import { motion } from "framer-motion";
import { Lightbulb, ArrowUpRight } from "lucide-react";
import type { AISuggestion } from "@/lib/api";

interface SuggestionsTabProps {
  suggestions: AISuggestion[];
  currentScore: number; // current effectiveness score
}

const priorityStyles = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-accent/15 text-accent",
  low: "bg-success/15 text-success",
};

const categoryIcons: Record<string, string> = {
  communication: "💬",
  leadership: "🎯",
  delegation: "📋",
  growth: "🌱",
  culture: "🤝",
};

const SuggestionsTab = ({ suggestions, currentScore }: SuggestionsTabProps) => {
  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-semibold text-foreground">
        AI-Generated Improvement Suggestions
      </h3>
      <p className="text-sm text-muted-foreground">
        Based on team feedback analysis, here are prioritized recommendations. Current effectiveness score: <span className="font-semibold text-foreground">{currentScore}%</span>
      </p>

      <div className="space-y-4">
        {suggestions.map((s, i) => (
          <motion.div
            key={s.id || i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-lg p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl mt-0.5">{categoryIcons[s.category] || "💡"}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-foreground text-sm">{s.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${priorityStyles[s.priority]}`}>
                      {s.priority}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="flex items-center gap-1 text-success">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="text-sm font-bold">{currentScore}% → {s.predictedScore}%</span>
                </div>
                <span className="text-xs text-muted-foreground">score boost</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionsTab;
