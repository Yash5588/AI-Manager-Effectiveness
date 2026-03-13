import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserCheck, Star, ChevronDown, ChevronUp, Target, MessageCircle,
    Sparkles, Zap, Loader2, Shield, TrendingUp, Trophy, BookOpen,
    AlertTriangle, Heart, Eye, X, BarChart3, Users2, Bot, Send, Lock,
} from "lucide-react";
import type { EmployeeCoachingProfile, TeamCoachingMetrics, EmployeeSuggestion, AttritionPrediction } from "@/lib/api";

interface EmployeeSuggestionsTabProps {
    coachingProfiles: EmployeeCoachingProfile[];
    teamMetrics: TeamCoachingMetrics | null;
    employeeSuggestions: EmployeeSuggestion[];
    currentScore: number;
    loading: boolean;
    coachingLoading: boolean;
    onGenerate: () => void;
    attritionPredictions: AttritionPrediction[];
    attritionLoading: boolean;
    onGenerateAttrition: () => void;
}

const moodEmojis: Record<string, string> = {
    thriving: "🚀", happy: "😊", neutral: "😐", stressed: "😰", struggling: "😞",
};

const moodColors: Record<string, string> = {
    thriving: "text-emerald-500", happy: "text-green-500", neutral: "text-amber-500",
    stressed: "text-orange-500", struggling: "text-red-500",
};

const riskColors: Record<string, string> = {
    High: "bg-red-500/15 text-red-600 border-red-500/30",
    Medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    Low: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

const statusColors: Record<string, string> = {
    "On Track": "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    "At Risk": "bg-amber-500/15 text-amber-600 border-amber-500/30",
    Behind: "bg-red-500/15 text-red-600 border-red-500/30",
};

function getScoreColor(score: number): string {
    if (score >= 75) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
}

function getBarColor(score: number): string {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
}

// ────────────────── Talent Profile Modal ──────────────────
const TalentProfileModal = ({
    employee, teamMetrics, suggestions, onClose,
}: {
    employee: EmployeeCoachingProfile;
    teamMetrics: TeamCoachingMetrics | null;
    suggestions: EmployeeSuggestion | null;
    onClose: () => void;
}) => {
    const ratingLabels: Record<string, string> = {
        communication: "Communication", recognition: "Recognition",
        availability: "Availability", careerGrowth: "Career Growth",
        empowerment: "Empowerment", fairness: "Fairness",
        decisionMaking: "Decision Making", conflictResolution: "Conflict Res.",
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                                {employee.name.split(" ").map(n => n[0]).join("")}
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-foreground">{employee.name}</h3>
                                <p className="text-xs text-muted-foreground">{employee.role}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Key metrics grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Achievement", value: `${employee.achievementScore}%`, icon: <Trophy className="h-3.5 w-3.5" />, color: getScoreColor(employee.achievementScore) },
                            { label: "Run Rate", value: `${employee.runRate}%`, icon: <TrendingUp className="h-3.5 w-3.5" />, color: getScoreColor(employee.runRate) },
                            { label: "Attrition Risk", value: `${employee.attritionRisk}%`, icon: <Shield className="h-3.5 w-3.5" />, color: employee.attritionRisk >= 70 ? "text-red-500" : employee.attritionRisk >= 40 ? "text-amber-500" : "text-emerald-500" },
                            { label: "Sentiment", value: `${Math.round(employee.feedbackSentiment * 100)}%`, icon: <Heart className="h-3.5 w-3.5" />, color: getScoreColor(employee.feedbackSentiment * 100) },
                        ].map((m, i) => (
                            <div key={i} className="p-3 rounded-xl bg-card border border-border">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={m.color}>{m.icon}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</span>
                                </div>
                                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Performance & Mood */}
                    <div className="p-4 rounded-xl bg-card border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Performance Rating</span>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }, (_, i) => (
                                    <Star key={i} className={`h-4 w-4 ${i < employee.performanceRating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pulse Mood</span>
                            <span className={`text-lg ${moodColors[employee.pulseMood] || "text-muted-foreground"}`}>
                                {moodEmojis[employee.pulseMood] || "😐"} {employee.pulseMood}
                            </span>
                        </div>
                    </div>

                    {/* Feedback Ratings Breakdown */}
                    {employee.avgRatings && (
                        <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <BarChart3 className="h-3 w-3" /> Feedback Ratings
                            </p>
                            <div className="space-y-2.5">
                                {Object.entries(employee.avgRatings).filter(([, v]) => v != null).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-28 truncate">{ratingLabels[key] || key}</span>
                                        <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${((val as number) / 5) * 100}%` }}
                                                transition={{ duration: 0.6 }}
                                                className={getBarColor(((val as number) / 5) * 100)}
                                                style={{ height: "100%", borderRadius: "9999px" }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-foreground w-8 text-right">{val}/5</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Team context */}
                    {teamMetrics && (
                        <div className="p-4 rounded-xl bg-card border border-border">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Users2 className="h-3 w-3" /> Team Context
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: "Goal Completion", value: `${teamMetrics.goalCompletionRate}%` },
                                    { label: "Dev Goals", value: `${teamMetrics.totalDevGoals}` },
                                    { label: "Avg Assignment", value: `${teamMetrics.avgDevGoalAssignment}` },
                                    { label: "Engagement", value: `${teamMetrics.engagementScore}%` },
                                ].map((m, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                                        <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
                                        <span className="text-xs font-bold text-foreground">{m.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Coaching Suggestions */}
                    {suggestions && suggestions.suggestions.length > 0 && (
                        <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
                            <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Sparkles className="h-3 w-3" /> Performance Coach Touchpoints
                            </p>
                            <p className="text-sm text-muted-foreground mb-3 italic">{suggestions.rationale}</p>
                            <div className="space-y-2.5">
                                {suggestions.suggestions.map((sug, si) => (
                                    <motion.div
                                        key={si} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: si * 0.08 }}
                                        className="p-3 rounded-lg bg-card border border-border"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Zap className="h-3 w-3 text-violet-500" />
                                            <h5 className="text-sm font-medium text-foreground">{sug.title}</h5>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{sug.description}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};


// ────────────────── Main Tab ──────────────────
const EmployeeSuggestionsTab = ({
    coachingProfiles, teamMetrics, employeeSuggestions,
    currentScore, loading, coachingLoading, onGenerate,
    attritionPredictions, attritionLoading, onGenerateAttrition,
}: EmployeeSuggestionsTabProps) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [talentProfileId, setTalentProfileId] = useState<string | null>(null);
    const [showCoach, setShowCoach] = useState(false);
    const [attritionDetailName, setAttritionDetailName] = useState<string | null>(null);

    if (coachingLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading employee coaching data...</p>
            </div>
        );
    }

    if (coachingProfiles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">No employees found for coaching.</p>
            </div>
        );
    }

    const talentProfile = talentProfileId ? coachingProfiles.find(e => e._id === talentProfileId) : null;
    const talentSuggestions = talentProfile
        ? employeeSuggestions.find(s => s.employeeName === talentProfile.name) || null
        : null;

    return (
        <div className="space-y-5">
            {/* ── Team Metrics Summary Bar ── */}
            {teamMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Target className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Goal Completion</span>
                        </div>
                        <p className={`text-xl font-bold ${getScoreColor(teamMetrics.goalCompletionRate)}`}>
                            {teamMetrics.goalCompletionRate}%
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                            <BookOpen className="h-3.5 w-3.5 text-violet-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dev Goals</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-xl font-bold text-foreground">{teamMetrics.totalDevGoals}</p>
                            <span className="text-[10px] text-muted-foreground">
                                avg {teamMetrics.avgDevGoalAssignment}/emp
                            </span>
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dev Status</span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusColors[teamMetrics.devGoalStatus] || ""}`}>
                            {teamMetrics.devGoalStatus}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Heart className="h-3.5 w-3.5 text-pink-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engagement</span>
                        </div>
                        <p className={`text-xl font-bold ${getScoreColor(teamMetrics.engagementScore)}`}>
                            {teamMetrics.engagementScore}%
                        </p>
                    </div>
                </div>
            )}

            {/* ── Header with AI Generate ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Employee Coaching</h3>
                    <p className="text-sm text-muted-foreground">
                        {coachingProfiles.length} team members · Score: <span className="font-semibold text-foreground">{currentScore}%</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCoach(true)}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
                    >
                        <Bot className="h-3.5 w-3.5" />
                        Performance Coach
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-white/20 leading-none">Soon</span>
                    </button>
                    <button
                        onClick={onGenerate}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {employeeSuggestions.length > 0 ? "Re-Analyse Performance" : "Analyse Employee Performance"}
                    </button>
                </div>
            </div>

            {/* ── Employee Cards ── */}
            <div className="space-y-3">
                {coachingProfiles.map((emp, i) => {
                    const isExpanded = expandedIndex === i;
                    const empSuggestion = employeeSuggestions.find(s => s.employeeName === emp.name);

                    return (
                        <motion.div
                            key={emp._id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="rounded-xl border border-border bg-card overflow-hidden"
                        >
                            {/* Card header — always visible */}
                            <button
                                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                                className="w-full text-left p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors"
                            >
                                {/* Avatar */}
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/80 to-violet-500/80 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                    {emp.name.split(" ").map(n => n[0]).join("")}
                                </div>

                                {/* Name & role */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground text-sm truncate">{emp.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                                </div>

                                {/* Key metric badges */}
                                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                                    {/* Achievement */}
                                    <div className="flex items-center gap-1">
                                        <Trophy className={`h-3 w-3 ${getScoreColor(emp.achievementScore)}`} />
                                        <span className={`text-xs font-bold ${getScoreColor(emp.achievementScore)}`}>
                                            {emp.achievementScore}%
                                        </span>
                                    </div>

                                    {/* Risk badge */}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskColors[emp.riskLevel]}`}>
                                        {emp.riskLevel}
                                    </span>

                                    {/* Mood */}
                                    <span className={`text-sm ${moodColors[emp.pulseMood] || ""}`} title={`Mood: ${emp.pulseMood}`}>
                                        {moodEmojis[emp.pulseMood] || "😐"}
                                    </span>
                                </div>

                                {/* Chevron */}
                                <div className="shrink-0 text-muted-foreground">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            </button>

                            {/* Expanded content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
                                            {/* Metrics grid */}
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { label: "Achievement", value: `${emp.achievementScore}%`, bar: emp.achievementScore },
                                                    { label: "Run Rate", value: `${emp.runRate}%`, bar: emp.runRate },
                                                    { label: "Attrition", value: `${emp.attritionRisk}%`, bar: emp.attritionRisk },
                                                    { label: "Sentiment", value: `${Math.round(emp.feedbackSentiment * 100)}%`, bar: emp.feedbackSentiment * 100 },
                                                    { label: "Rating", value: `${emp.performanceRating}/5`, bar: (emp.performanceRating / 5) * 100 },
                                                    { label: "Feedbacks", value: `${emp.feedbackCount}`, bar: Math.min(100, emp.feedbackCount * 20) },
                                                ].map((m, mi) => (
                                                    <div key={mi} className="p-2.5 rounded-lg bg-secondary/30">
                                                        <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
                                                        <p className={`text-sm font-bold ${getScoreColor(m.bar)}`}>{m.value}</p>
                                                        <div className="mt-1 h-1 rounded-full bg-secondary/60 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${Math.min(100, m.bar)}%` }}
                                                                transition={{ duration: 0.5, delay: mi * 0.05 }}
                                                                className={`h-full rounded-full ${getBarColor(m.bar)}`}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Coaching touchpoints (if AI generated) */}
                                            {empSuggestion && empSuggestion.suggestions.length > 0 && (
                                                <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                        <Sparkles className="h-3 w-3" /> Coach Touchpoints
                                                    </p>
                                                    <div className="space-y-2">
                                                        {empSuggestion.suggestions.slice(0, 3).map((sug, si) => (
                                                            <div key={si} className="flex items-start gap-2">
                                                                <Zap className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-medium text-foreground">{sug.title}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{sug.description}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {!empSuggestion && employeeSuggestions.length === 0 && (
                                                <div className="p-3 rounded-lg bg-secondary/30 border border-border text-center">
                                                    <p className="text-xs text-muted-foreground">
                                                        Click <strong>"Analyse Employee Performance"</strong> above to get coaching touchpoints
                                                    </p>
                                                </div>
                                            )}

                                            {/* View Talent Profile button */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setTalentProfileId(emp._id); }}
                                                    className="flex-1 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Eye className="h-3.5 w-3.5 text-blue-500" />
                                                    View Talent Profile
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (attritionPredictions.length === 0 && !attritionLoading) {
                                                            onGenerateAttrition();
                                                        }
                                                        setAttritionDetailName(emp.name);
                                                    }}
                                                    className="flex-1 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs font-medium text-red-600 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    View Attrition Risk
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Talent Profile Modal */}
            <AnimatePresence>
                {talentProfile && (
                    <TalentProfileModal
                        employee={talentProfile}
                        teamMetrics={teamMetrics}
                        suggestions={talentSuggestions}
                        onClose={() => setTalentProfileId(null)}
                    />
                )}
            </AnimatePresence>

            {/* Performance Coach Side Modal */}
            <AnimatePresence>
                {showCoach && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCoach(false)} />
                        <motion.div
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col"
                        >
                            {/* Header */}
                            <div className="border-b border-border p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                            <Bot className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-display text-lg font-semibold text-foreground">Performance Coach</h3>
                                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                                                    <Lock className="h-2.5 w-2.5" /> Coming Soon
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">AI-powered coaching assistant</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowCoach(false)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>

                            {/* Chat area — placeholder for future messages */}
                            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 flex items-center justify-center">
                                    <Bot className="h-10 w-10 text-violet-500/60" />
                                </div>
                                <div className="text-center max-w-xs">
                                    <h4 className="font-display text-base font-semibold text-foreground mb-1">AI Performance Coach</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Ask questions about any employee's performance, get personalized coaching tips, and explore growth opportunities.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                    {[
                                        "How is John performing this quarter?",
                                        "Who needs coaching attention?",
                                        "Suggest a development plan for...",
                                        "Compare team performance trends",
                                    ].map((hint, i) => (
                                        <span
                                            key={i}
                                            className="px-3 py-1.5 text-xs rounded-full bg-secondary/50 border border-border text-muted-foreground cursor-not-allowed opacity-50"
                                        >
                                            {hint}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground/50 mt-4">
                                    🤖 This agent is under active development. Stay tuned!
                                </p>
                            </div>

                            {/* Input area — disabled for now */}
                            <div className="border-t border-border p-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        disabled
                                        placeholder="Ask about an employee's performance..."
                                        className="flex-1 px-4 py-2.5 rounded-lg bg-secondary/40 border border-border text-sm text-muted-foreground placeholder:text-muted-foreground/50 cursor-not-allowed opacity-60"
                                    />
                                    <button
                                        disabled
                                        className="p-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white opacity-40 cursor-not-allowed"
                                        title="Coming Soon"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Attrition Risk Detail Side Modal */}
            <AnimatePresence>
                {attritionDetailName && (() => {
                    const pred = attritionPredictions.find(p => p.employeeName === attritionDetailName);
                    return (
                        <div className="fixed inset-0 z-50 flex justify-end">
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAttritionDetailName(null)} />
                            <motion.div
                                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto"
                            >
                                {/* Header */}
                                <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                                {attritionDetailName.split(" ").map(n => n[0]).join("")}
                                            </div>
                                            <div>
                                                <h3 className="font-display text-lg font-semibold text-foreground">{attritionDetailName}</h3>
                                                <p className="text-xs text-muted-foreground">Attrition Risk Analysis</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setAttritionDetailName(null)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                                            <X className="h-5 w-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    {attritionLoading && !pred && (
                                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Running attrition risk analysis...</p>
                                        </div>
                                    )}

                                    {!attritionLoading && !pred && (
                                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                                            <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                                <AlertTriangle className="h-8 w-8 text-red-500/60" />
                                            </div>
                                            <p className="text-sm text-muted-foreground text-center">No attrition data available for this employee yet.</p>
                                            <button
                                                onClick={onGenerateAttrition}
                                                className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                            >
                                                Run Analysis
                                            </button>
                                        </div>
                                    )}

                                    {pred && (
                                        <>
                                            {/* Risk & Impact metrics */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-4 rounded-xl bg-card border border-border">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <AlertTriangle className={`h-3.5 w-3.5 ${pred.flightRisk >= 70 ? "text-red-500" : pred.flightRisk >= 40 ? "text-amber-500" : "text-emerald-500"}`} />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flight Risk</span>
                                                    </div>
                                                    <p className={`text-2xl font-bold ${pred.flightRisk >= 70 ? "text-red-500" : pred.flightRisk >= 40 ? "text-amber-500" : "text-emerald-500"}`}>
                                                        {pred.flightRisk}%
                                                    </p>
                                                    <div className="mt-2 h-2 rounded-full bg-secondary/60 overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${pred.flightRisk}%` }}
                                                            transition={{ duration: 0.8 }}
                                                            className={`h-full rounded-full ${pred.flightRisk >= 70 ? "bg-red-500" : pred.flightRisk >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                        />
                                                    </div>
                                                    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${pred.riskLevel === "High" ? "bg-red-500/15 text-red-600 border-red-500/30" :
                                                            pred.riskLevel === "Medium" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                                                                "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                                        }`}>{pred.riskLevel} Risk</span>
                                                </div>
                                                <div className="p-4 rounded-xl bg-card border border-border">
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Impact Score</span>
                                                    </div>
                                                    <p className="text-2xl font-bold text-blue-500">
                                                        {pred.impactScore}%
                                                    </p>
                                                    <div className="mt-2 h-2 rounded-full bg-secondary/60 overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${pred.impactScore}%` }}
                                                            transition={{ duration: 0.8 }}
                                                            className="h-full rounded-full bg-blue-500"
                                                        />
                                                    </div>
                                                    <span className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${pred.impactLevel === "High" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" :
                                                            pred.impactLevel === "Medium" ? "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" :
                                                                "bg-slate-500/15 text-slate-600 border-slate-500/30"
                                                        }`}>{pred.impactLevel} Impact</span>
                                                </div>
                                            </div>

                                            {/* Priority Badge */}
                                            <div className={`p-3 rounded-xl border text-center ${pred.riskLevel === "High" && pred.impactLevel === "High"
                                                    ? "bg-red-500/10 border-red-500/20"
                                                    : pred.riskLevel === "High"
                                                        ? "bg-amber-500/10 border-amber-500/20"
                                                        : "bg-secondary/30 border-border"
                                                }`}>
                                                <span className={`text-xs font-bold ${pred.riskLevel === "High" && pred.impactLevel === "High"
                                                        ? "text-red-600"
                                                        : pred.riskLevel === "High"
                                                            ? "text-amber-600"
                                                            : "text-muted-foreground"
                                                    }`}>
                                                    {pred.riskLevel === "High" && pred.impactLevel === "High"
                                                        ? "⚠️ Immediate Action Required"
                                                        : pred.riskLevel === "High"
                                                            ? "🔸 Proactive Retention Needed"
                                                            : "✅ Currently Stable"}
                                                </span>
                                            </div>

                                            {/* AI Rationale */}
                                            <div className="p-4 rounded-xl bg-card border border-border">
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <Sparkles className="h-3 w-3 text-violet-500" /> AI Analysis
                                                </p>
                                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                                    {pred.rationale}
                                                </p>
                                            </div>

                                            {/* Recommendation */}
                                            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
                                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <Zap className="h-3 w-3" /> Recommended Action
                                                </p>
                                                <p className="text-sm font-medium text-foreground leading-relaxed">
                                                    {pred.recommendation}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
};

export default EmployeeSuggestionsTab;
