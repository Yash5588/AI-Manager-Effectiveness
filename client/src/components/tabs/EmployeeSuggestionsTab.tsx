import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserCheck,
    ArrowUpRight,
    Star,
    ChevronDown,
    ChevronUp,
    Target,
    MessageCircle,
    Users2,
    Sparkles,
    Zap,
    Loader2,
} from "lucide-react";
import type { EmployeeSuggestion } from "@/lib/api";

interface EmployeeSuggestionsTabProps {
    employeeSuggestions: EmployeeSuggestion[];
    currentScore: number;
    loading: boolean;
    onGenerate: () => void;
}

const focusIcons: Record<string, React.ReactNode> = {
    performance: <Target className="h-3.5 w-3.5" />,
    communication: <MessageCircle className="h-3.5 w-3.5" />,
    collaboration: <Users2 className="h-3.5 w-3.5" />,
    skills: <Sparkles className="h-3.5 w-3.5" />,
    initiative: <Zap className="h-3.5 w-3.5" />,
};

const focusColors: Record<string, string> = {
    performance: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    communication: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    collaboration: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    skills: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    initiative: "bg-rose-500/15 text-rose-400 border-rose-500/20",
};

function getRatingColor(rating: number): string {
    if (rating >= 4) return "text-success";
    if (rating >= 3) return "text-accent";
    return "text-destructive";
}

function getRatingLabel(rating: number): string {
    if (rating >= 5) return "Outstanding";
    if (rating >= 4) return "Strong";
    if (rating >= 3) return "Average";
    if (rating >= 2) return "Below Avg";
    return "Needs Work";
}

const EmployeeSuggestionsTab = ({
    employeeSuggestions,
    currentScore,
    loading,
    onGenerate,
}: EmployeeSuggestionsTabProps) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const toggleExpand = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                    Generating personalized suggestions for each employee...
                </p>
                <p className="text-xs text-muted-foreground/60">
                    This may take a moment as we analyze performance data
                </p>
            </div>
        );
    }

    if (employeeSuggestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                    <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                        Employee Suggestions
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Generate AI-powered, personalized suggestions for each employee to
                        help boost your management effectiveness score.
                    </p>
                </div>
                <button
                    onClick={onGenerate}
                    className="mt-2 px-6 py-2.5 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <Sparkles className="h-4 w-4" />
                    Generate Employee Suggestions
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">
                        Per-Employee Suggestions
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Personalized recommendations for each team member. Current score:{" "}
                        <span className="font-semibold text-foreground">
                            {currentScore}%
                        </span>
                    </p>
                </div>
                <button
                    onClick={onGenerate}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
                >
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate
                </button>
            </div>

            {/* Employee cards */}
            <div className="space-y-4">
                {employeeSuggestions.map((emp, i) => {
                    const isExpanded = expandedIndex === i;
                    const scoreBoost = emp.predictedManagerScore - currentScore;

                    return (
                        <motion.div
                            key={`${emp.employeeName}-${i}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="glass-card rounded-xl overflow-hidden"
                        >
                            {/* Employee header — always visible */}
                            <button
                                onClick={() => toggleExpand(i)}
                                className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {/* Avatar */}
                                    <div className="h-11 w-11 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                                        {emp.employeeName
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")}
                                    </div>

                                    {/* Name & role */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground text-sm truncate">
                                            {emp.employeeName}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {emp.employeeRole}
                                        </p>
                                    </div>

                                    {/* Rating badge */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Star className={`h-3.5 w-3.5 ${getRatingColor(emp.currentRating)}`} />
                                        <span className={`text-sm font-semibold ${getRatingColor(emp.currentRating)}`}>
                                            {emp.currentRating}/5
                                        </span>
                                        <span className="text-xs text-muted-foreground hidden sm:inline">
                                            ({getRatingLabel(emp.currentRating)})
                                        </span>
                                    </div>

                                    {/* Predicted score boost */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <div className="flex items-center gap-1 text-success">
                                            <ArrowUpRight className="h-4 w-4" />
                                            <span className="text-sm font-bold">
                                                +{scoreBoost}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground hidden sm:inline">
                                            → {emp.predictedManagerScore}%
                                        </span>
                                    </div>
                                </div>

                                {/* Expand/collapse */}
                                <div className="shrink-0 text-muted-foreground">
                                    {isExpanded ? (
                                        <ChevronUp className="h-5 w-5" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-5 pt-0 space-y-4">
                                            {/* Divider */}
                                            <div className="h-px bg-border" />

                                            {/* Rationale */}
                                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                                <p className="text-xs font-medium text-primary mb-1">
                                                    💡 Why these suggestions?
                                                </p>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {emp.rationale}
                                                </p>
                                            </div>

                                            {/* Score prediction bar */}
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    Score projection
                                                </span>
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                                                    {/* Current score */}
                                                    <motion.div
                                                        className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${currentScore}%` }}
                                                        transition={{ duration: 0.6, delay: 0.1 }}
                                                    />
                                                    {/* Predicted score */}
                                                    <motion.div
                                                        className="absolute inset-y-0 left-0 rounded-full gradient-primary"
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${emp.predictedManagerScore}%`,
                                                        }}
                                                        transition={{ duration: 0.8, delay: 0.3 }}
                                                    />
                                                </div>
                                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                                    {currentScore}% → {emp.predictedManagerScore}%
                                                </span>
                                            </div>

                                            {/* Individual suggestions */}
                                            <div className="space-y-3">
                                                {emp.suggestions.map((sug, si) => (
                                                    <motion.div
                                                        key={si}
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: si * 0.1 + 0.2 }}
                                                        className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border/50"
                                                    >
                                                        <div
                                                            className={`mt-0.5 p-1.5 rounded-md border ${focusColors[sug.focus] ||
                                                                "bg-secondary text-secondary-foreground border-border"
                                                                }`}
                                                        >
                                                            {focusIcons[sug.focus] || (
                                                                <Target className="h-3.5 w-3.5" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                                <h5 className="text-sm font-medium text-foreground">
                                                                    {sug.title}
                                                                </h5>
                                                                <span
                                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize border ${focusColors[sug.focus] ||
                                                                        "bg-secondary text-secondary-foreground border-border"
                                                                        }`}
                                                                >
                                                                    {sug.focus}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                                {sug.description}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default EmployeeSuggestionsTab;
