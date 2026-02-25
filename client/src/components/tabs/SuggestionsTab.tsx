import { motion } from "framer-motion";
import { Lightbulb, ArrowUpRight, Sparkles, Loader2 } from "lucide-react";
import type { AISuggestion } from "@/lib/api";

interface SuggestionsTabProps {
  suggestions: AISuggestion[];
  currentScore: number; // current effectiveness score
  loading?: boolean;
  onGenerate?: () => void;
}

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/20",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  low: "bg-success/15 text-success border-success/20",
};

const categoryIcons: Record<string, string> = {
  communication: "💬",
  leadership: "🎯",
  delegation: "📋",
  growth: "🌱",
  culture: "🤝",
};

const SuggestionsTab = ({ suggestions, currentScore, loading, onGenerate }: SuggestionsTabProps) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          AI is analyzing manager performance and generating suggestions...
        </p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lightbulb className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">
            No Suggestions Yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            We couldn't generate suggestions automatically. Click below to try again.
          </p>
        </div>
        <button
          onClick={onGenerate}
          className="mt-2 px-6 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Generate Suggestions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            AI-Generated Improvement Suggestions
          </h3>
          <p className="text-sm text-muted-foreground">
            Based on team feedback analysis, here are prioritized recommendations.
          </p>
        </div>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="px-4 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Regenerate
          </button>
        )}
      </div>

      <div className="space-y-4">
        {suggestions.map((s, i) => (
          <motion.div
            key={s.id || i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card rounded-lg p-5 border border-border/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-xl mt-0.5 shrink-0">{categoryIcons[s.category] || "💡"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h4 className="font-medium text-foreground text-sm">{s.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border ${priorityStyles[s.priority] || "bg-secondary text-secondary-foreground"}`}>
                      {s.priority}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium capitalize border border-border/50">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0 bg-success/5 p-2 rounded-lg border border-success/10">
                <div className="flex items-center gap-1 text-success">
                  <ArrowUpRight className="h-4 w-4" />
                  <span className="text-sm font-bold">{currentScore}% → {s.predictedScore}%</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-success/70">score boost</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionsTab;
