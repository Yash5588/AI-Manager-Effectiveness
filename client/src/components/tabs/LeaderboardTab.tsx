import { motion } from "framer-motion";
import {
    Sparkles,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Loader2,
    Trophy,
} from "lucide-react";
import { type LeaderboardEntry } from "@/lib/api";

function getCategoryColor(category: string) {
    if (category === "Excellent") return "text-emerald-400";
    if (category === "Good") return "text-primary";
    if (category === "Average") return "text-amber-400";
    return "text-red-400";
}

function getCategoryBg(cat: string) {
    if (cat === "Excellent") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (cat === "Good") return "bg-primary/10 text-primary border-primary/20";
    if (cat === "Average") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
}

interface LeaderboardTabProps {
    leaderboard: LeaderboardEntry[];
    currentManagerId: string;
    loading: boolean;
}

const LeaderboardTab = ({ leaderboard, currentManagerId, loading }: LeaderboardTabProps) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Trophy className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">No leaderboard data available yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-display text-lg font-semibold text-foreground">Manager Leaderboard</h3>
                <p className="text-sm text-muted-foreground">Ranked by effectiveness score with 7-day trend</p>
            </div>

            <div className="space-y-3">
                {leaderboard.map((entry, i) => {
                    const isTop3 = entry.rank <= 3;
                    const medals = ["🥇", "🥈", "🥉"];
                    const isCurrentManager = entry.id === currentManagerId;

                    return (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className={`glass-card rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap ${isCurrentManager
                                    ? "ring-2 ring-primary/60 border-primary/40 bg-primary/5"
                                    : isTop3
                                        ? "border-2 border-primary/20"
                                        : ""
                                }`}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                {/* Rank */}
                                <div
                                    className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${isTop3
                                            ? "gradient-primary text-primary-foreground"
                                            : "bg-secondary text-muted-foreground"
                                        }`}
                                >
                                    {isTop3 ? medals[entry.rank - 1] : entry.rank}
                                </div>
                                {/* Avatar + info */}
                                <div className="min-w-0">
                                    <p className="font-medium text-foreground text-sm truncate flex items-center gap-2">
                                        {entry.name}
                                        {isCurrentManager && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                                                YOU
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {entry.department} · {entry.experienceYears}yr exp · {entry.counts.employees} employees
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-5">
                                {/* Effectiveness */}
                                <div className="text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                        <p className={`text-xl font-display font-bold ${getCategoryColor(entry.category)}`}>
                                            {entry.effectivenessScore}%
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Manager Score</p>
                                </div>

                                {/* Sentiment */}
                                <div className="text-center">
                                    <p className="text-xl font-display font-bold text-foreground">
                                        {Math.round(entry.sentimentScore * 100)}%
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Sentiment</p>
                                </div>

                                {/* 7-day trend */}
                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                    {entry.trend > 0 ? (
                                        <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                                    ) : entry.trend < 0 ? (
                                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                                    ) : (
                                        <Minus className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span
                                        className={`text-sm font-semibold ${entry.trend > 0
                                                ? "text-emerald-400"
                                                : entry.trend < 0
                                                    ? "text-red-400"
                                                    : "text-muted-foreground"
                                            }`}
                                    >
                                        {entry.trend > 0 ? "+" : ""}
                                        {entry.trend}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">7d</span>
                                </div>

                                {/* Category badge */}
                                <span
                                    className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${getCategoryBg(entry.category)}`}
                                >
                                    {entry.category}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default LeaderboardTab;
