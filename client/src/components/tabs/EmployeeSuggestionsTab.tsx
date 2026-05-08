import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserCheck, Star, ChevronDown, ChevronUp, Target, MessageCircle,
    Sparkles, Zap, Loader2, Shield, TrendingUp, Trophy, BookOpen,
    AlertTriangle, Heart, Eye, X, BarChart3, Users2, Bot, Send,
} from "lucide-react";
import type { EmployeeCoachingProfile, TeamCoachingMetrics, EmployeeSuggestion, AttritionPrediction, EmployeeActionable, EmployeeActionableImpact, ActionableProgress } from "@/lib/api";

interface EmployeeSuggestionsTabProps {
    coachingProfiles: EmployeeCoachingProfile[];
    teamMetrics: TeamCoachingMetrics | null;
    employeeSuggestions: EmployeeSuggestion[];
    currentScore: number;
    loading: boolean;
    coachingLoading: boolean;
    onGenerate: () => void;
    onToggleActionable: (
        actionableId: string,
        completed: boolean,
        completion?: {
            impact?: EmployeeActionableImpact;
            completionMetric?: string;
            completionNote?: string;
            formData?: Record<string, unknown>;
        }
    ) => Promise<void> | void;
    attritionPredictions: AttritionPrediction[];
    attritionLoading: boolean;
    onGenerateAttrition: () => void;
    actionableProgress?: ActionableProgress | null;
}



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

type KpiImpactKey =
    | "goalCompletionRateDelta"
    | "engagementScoreDelta"
    | "teamRetentionRateDelta"
    | "subordinate360RatingDelta"
    | "idpDelta";

const KPI_IMPACT_CONFIG: Record<KpiImpactKey, { label: string; actionTitle: string; unit: string; defaultDelta: number; max: number }> = {
    goalCompletionRateDelta: {
        label: "Goal Completion",
        actionTitle: "Update Goal Completion",
        unit: "percentage points",
        defaultDelta: 1,
        max: 10,
    },
    engagementScoreDelta: {
        label: "Engagement Score",
        actionTitle: "Improve Engagement",
        unit: "percentage points",
        defaultDelta: 1,
        max: 10,
    },
    teamRetentionRateDelta: {
        label: "Team Retention",
        actionTitle: "Improve Retention",
        unit: "percentage points",
        defaultDelta: 1,
        max: 10,
    },
    subordinate360RatingDelta: {
        label: "360 Rating",
        actionTitle: "Improve 360 Feedback",
        unit: "percentage points",
        defaultDelta: 1,
        max: 10,
    },
    idpDelta: {
        label: "Development Goals",
        actionTitle: "Assign Dev Goals",
        unit: "goals",
        defaultDelta: 1,
        max: 5,
    },
};

const KPI_IMPACT_KEYS = Object.keys(KPI_IMPACT_CONFIG) as KpiImpactKey[];

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

function getKpiImpactEntries(impact?: EmployeeActionableImpact): Array<[KpiImpactKey, number]> {
    if (!impact) return [];
    return KPI_IMPACT_KEYS
        .map((key) => [key, Number(impact[key] || 0)] as [KpiImpactKey, number])
        .filter(([, value]) => Number.isFinite(value) && value !== 0);
}

function getDefaultKpiKey(suggestion: EmployeeSuggestion["suggestions"][number], actionable?: EmployeeActionable): KpiImpactKey {
    switch (suggestion.focus) {
        case "skills":
            return "idpDelta";
        case "wellbeing":
        case "collaboration":
            return "engagementScoreDelta";
        case "communication":
            return "subordinate360RatingDelta";
        case "initiative":
        case "performance":
            return "goalCompletionRateDelta";
        default: {
            const existingKpi = getKpiImpactEntries(actionable?.impact)[0]?.[0];
            return existingKpi || "goalCompletionRateDelta";
        }
    }
}

function getActionableHeading(suggestion: EmployeeSuggestion["suggestions"][number], actionable: EmployeeActionable): string {
    const key = getDefaultKpiKey(suggestion, actionable);
    return KPI_IMPACT_CONFIG[key].actionTitle;
}

function formatActionableImpact(actionable: EmployeeActionable): string | null {
    const parts = getKpiImpactEntries(actionable.impact).map(([key, value]) => {
        const config = KPI_IMPACT_CONFIG[key];
        const prefix = value > 0 ? "+" : "";
        return `${config.label} ${prefix}${value}${key === "idpDelta" ? "" : " pts"}`;
    });

    return parts.length > 0 ? parts.join(" · ") : "KPI change required";
}

function getPrimaryActionable(suggestion: EmployeeSuggestion["suggestions"][number]): EmployeeActionable | null {
    return suggestion.actionables?.[0] || null;
}

const TouchpointAction = ({
    suggestion,
    pendingById,
    onAct,
}: {
    suggestion: EmployeeSuggestion["suggestions"][number];
    pendingById: Record<string, boolean>;
    onAct: (suggestion: EmployeeSuggestion["suggestions"][number], actionable: EmployeeActionable) => void;
}) => {
    const primaryActionable = getPrimaryActionable(suggestion);

    if (!primaryActionable) {
        return (
            <div>
                <p className="text-xs font-medium text-foreground">{suggestion.title}</p>
                <p className="text-[10px] text-muted-foreground">{suggestion.description}</p>
            </div>
        );
    }

    const pending = pendingById[primaryActionable.id] === true;
    const completed = primaryActionable.completed;
    const impactLabel = formatActionableImpact(primaryActionable);

    return (
        <div className={`rounded-lg border p-2.5 ${completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-background/50"}`}>
            <div className="min-w-0">
                <p className={`text-xs font-medium ${completed ? "text-emerald-700 line-through" : "text-foreground"}`}>
                    {getActionableHeading(suggestion, primaryActionable)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{suggestion.description}</p>
                {impactLabel && (
                    <p className="text-[10px] text-violet-600 mt-1">KPI change: {impactLabel}</p>
                )}
            </div>
            <div className="mt-2 flex items-center gap-2">
                <button
                    type="button"
                    disabled={pending || completed}
                    onClick={() => onAct(suggestion, primaryActionable)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors inline-flex items-center gap-1 ${completed ? "bg-emerald-600 text-white" : "bg-violet-600 text-white hover:bg-violet-700"} disabled:opacity-60`}
                >
                    {!pending && !completed && <Sparkles className="h-2.5 w-2.5" />}
                    {pending ? "Updating..." : completed ? "Completed" : "Act"}
                </button>
                {completed && (
                    <span className="text-[10px] font-medium text-emerald-700">Touchpoint completed</span>
                )}
            </div>
        </div>
    );
};

type ActiveKpiAction = {
    suggestion: EmployeeSuggestion["suggestions"][number];
    actionable: EmployeeActionable;
};

const KpiActionModal = ({
    action,
    pending,
    onClose,
    onComplete,
}: {
    action: ActiveKpiAction | null;
    pending: boolean;
    onClose: () => void;
    onComplete: (
        actionableId: string,
        impact: EmployeeActionableImpact,
        completionMetric: string,
        completionNote: string,
        formData: Record<string, unknown>
    ) => Promise<void> | void;
}) => {
    const [selectedMetric, setSelectedMetric] = useState<KpiImpactKey>("goalCompletionRateDelta");
    const [delta, setDelta] = useState("1");
    const [formValues, setFormValues] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!action) return;
        const metric = getDefaultKpiKey(action.suggestion, action.actionable);
        const existingDelta = Number(action.actionable.impact?.[metric] || KPI_IMPACT_CONFIG[metric].defaultDelta);
        setSelectedMetric(metric);
        setDelta(String(metric === "idpDelta" ? Math.max(1, Math.round(existingDelta)) : existingDelta));
        setFormValues({});
    }, [action]);

    if (!action) return null;

    const config = KPI_IMPACT_CONFIG[selectedMetric];
    const numericDelta = Number(delta);
    const requiredFieldsByMetric: Record<KpiImpactKey, string[]> = {
        goalCompletionRateDelta: ["goalName", "completionEvidence", "checkpointDate"],
        engagementScoreDelta: ["engagementAction", "employeeSignal", "followUpDate"],
        teamRetentionRateDelta: ["retentionAction", "riskAddressed", "followUpDate"],
        subordinate360RatingDelta: ["feedbackTheme", "behaviorChange", "reviewDate"],
        idpDelta: ["devGoalTitle", "targetSkill", "dueDate"],
    };
    const requiredFields = requiredFieldsByMetric[selectedMetric];
    const fieldsValid = requiredFields.every((field) => formValues[field]?.trim());
    const isValid = Number.isFinite(numericDelta) && numericDelta > 0 && numericDelta <= config.max && fieldsValid;
    const updateField = (field: string, value: string) => setFormValues((prev) => ({ ...prev, [field]: value }));
    const completionNote = requiredFields
        .map((field) => formValues[field]?.trim())
        .filter(Boolean)
        .join(" | ");

    const handleSubmit = async () => {
        if (!isValid) return;
        await onComplete(
            action.actionable.id,
            { [selectedMetric]: numericDelta },
            selectedMetric,
            completionNote,
            {
                metric: selectedMetric,
                ...formValues,
                delta: numericDelta,
            }
        );
    };

    const renderMetricForm = () => {
        const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-violet-500";
        const renderField = (field: string, label: string, placeholder: string, type = "text") => (
            <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <input
                    type={type}
                    value={formValues[field] || ""}
                    onChange={(event) => updateField(field, event.target.value)}
                    placeholder={placeholder}
                    className={inputClass}
                />
            </label>
        );

        switch (selectedMetric) {
            case "idpDelta":
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderField("devGoalTitle", "Development Goal", "Cloud fundamentals certification")}
                        {renderField("targetSkill", "Target Skill", "System design / Java / communication")}
                        {renderField("dueDate", "Due Date", "", "date")}
                    </div>
                );
            case "goalCompletionRateDelta":
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderField("goalName", "Goal Name", "Q2 roadmap milestone")}
                        {renderField("completionEvidence", "Completion Evidence", "Milestone accepted in sprint review")}
                        {renderField("checkpointDate", "Checkpoint Date", "", "date")}
                    </div>
                );
            case "engagementScoreDelta":
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderField("engagementAction", "Engagement Action", "Weekly 1:1 and recognition check-in")}
                        {renderField("employeeSignal", "Employee Signal", "Employee confirmed improved clarity")}
                        {renderField("followUpDate", "Follow-up Date", "", "date")}
                    </div>
                );
            case "teamRetentionRateDelta":
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderField("retentionAction", "Retention Action", "Career path discussion completed")}
                        {renderField("riskAddressed", "Risk Addressed", "Growth concern / workload concern")}
                        {renderField("followUpDate", "Follow-up Date", "", "date")}
                    </div>
                );
            case "subordinate360RatingDelta":
            default:
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {renderField("feedbackTheme", "Feedback Theme", "Communication clarity")}
                        {renderField("behaviorChange", "Behavior Change", "Shared written decisions after meetings")}
                        {renderField("reviewDate", "Review Date", "", "date")}
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={pending ? undefined : onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="relative w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
            >
                <div className="border-b border-border p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Complete KPI Actionable</p>
                        <h3 className="font-display text-lg font-semibold text-foreground">
                            {KPI_IMPACT_CONFIG[getDefaultKpiKey(action.suggestion, action.actionable)].actionTitle}
                        </h3>
                    </div>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-3">
                        <p className="text-xs font-medium text-foreground">{action.suggestion.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{action.suggestion.description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">KPI Metric</span>
                            <p className="text-sm font-semibold text-foreground mt-1">{config.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">This form updates the persisted KPI metric and recalculates the score.</p>
                        </div>
                        <label className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Change</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0.1"
                                    max={config.max}
                                    step={selectedMetric === "idpDelta" ? "1" : "0.1"}
                                    value={delta}
                                    onChange={(event) => setDelta(event.target.value)}
                                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-violet-500"
                                />
                                <span className="text-[10px] text-muted-foreground min-w-16">{config.unit}</span>
                            </div>
                        </label>
                    </div>

                    {renderMetricForm()}

                    {!isValid && (
                        <p className="text-[11px] text-amber-600">
                            Fill every form field and enter a positive KPI change before completing this actionable.
                        </p>
                    )}
                </div>

                <div className="border-t border-border p-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        disabled={pending}
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!isValid || pending}
                        onClick={handleSubmit}
                        className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Complete & Apply KPI Change
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

/**
 * Employee Effectiveness Score (EES)
 * Composite score combining all available employee metrics.
 *
 * Formula:
 *   EES = Achievement(25%) + RunRate(20%) + RetentionStability(15%)
 *       + Sentiment(15%) + PerformanceRating(15%) + FeedbackEngagement(10%)
 *
 * Where:
 *   - RetentionStability = 100 - attritionRisk  (inverted — lower risk = higher score)
 *   - Sentiment = feedbackSentiment × 100       (normalized 0-1 → 0-100)
 *   - PerformanceRating = (rating / 5) × 100    (normalized 0-5 → 0-100)
 *   - FeedbackEngagement = min(100, feedbackCount × 20) (capped at 100)
 */
function computeEmployeeEffectivenessScore(emp: EmployeeCoachingProfile, flightRiskOverride?: number): number {
    const achievement = emp.achievementScore;                    // 0-100
    const runRate = emp.runRate;                                 // 0-100
    const retention = 100 - (flightRiskOverride ?? emp.attritionRisk); // inverted
    const sentiment = emp.feedbackSentiment * 100;               // 0-1 → 0-100
    const rating = (emp.performanceRating / 5) * 100;            // 0-5 → 0-100
    const engagement = Math.min(100, emp.feedbackCount * 20);    // capped at 100

    return Math.round(
        achievement * 0.25 +
        runRate * 0.20 +
        retention * 0.15 +
        sentiment * 0.15 +
        rating * 0.15 +
        engagement * 0.10
    );
}

// ────────────────── Talent Profile Modal ──────────────────
const TalentProfileModal = ({
    employee, teamMetrics, suggestions, attritionPrediction, attritionLoading, onClose,
}: {
    employee: EmployeeCoachingProfile;
    teamMetrics: TeamCoachingMetrics | null;
    suggestions: EmployeeSuggestion | null;
    attritionPrediction: AttritionPrediction | null;
    attritionLoading: boolean;
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
                        {(() => {
                            const ees = computeEmployeeEffectivenessScore(employee, attritionPrediction?.flightRisk);
                            return [
                                { label: "Effectiveness Score", value: `${ees}%`, icon: <Zap className="h-3.5 w-3.5" />, color: getScoreColor(ees) },
                                { label: "Achievement", value: `${employee.achievementScore}%`, icon: <Trophy className="h-3.5 w-3.5" />, color: getScoreColor(employee.achievementScore) },
                                { label: "Run Rate", value: `${employee.runRate}%`, icon: <TrendingUp className="h-3.5 w-3.5" />, color: getScoreColor(employee.runRate) },
                                { label: "Flight Risk", value: `${attritionPrediction?.flightRisk ?? employee.attritionRisk}%`, icon: <AlertTriangle className="h-3.5 w-3.5" />, color: (attritionPrediction?.flightRisk ?? employee.attritionRisk) >= 70 ? "text-red-500" : (attritionPrediction?.flightRisk ?? employee.attritionRisk) >= 40 ? "text-amber-500" : "text-emerald-500" },
                                { label: "Impact Score", value: `${attritionPrediction?.impactScore ?? 0}%`, icon: <Shield className="h-3.5 w-3.5" />, color: (attritionPrediction?.impactScore ?? 0) >= 70 ? "text-red-500" : (attritionPrediction?.impactScore ?? 0) >= 40 ? "text-amber-500" : "text-emerald-500" },
                                { label: "Sentiment", value: `${Math.round(employee.feedbackSentiment * 100)}%`, icon: <Heart className="h-3.5 w-3.5" />, color: getScoreColor(employee.feedbackSentiment * 100) },
                            ];
                        })().map((m, i) => (
                            <div key={i} className="p-3 rounded-xl bg-card border border-border">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={m.color}>{m.icon}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{m.label}</span>
                                </div>
                                <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Performance */}
                    <div className="p-4 rounded-xl bg-card border border-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Performance Rating</span>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }, (_, i) => (
                                    <Star key={i} className={`h-4 w-4 ${i < employee.performanceRating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                                ))}
                            </div>
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

                    {/* Attrition Risk Analysis */}
                    {attritionLoading && (
                        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Analyzing attrition risk...</span>
                        </div>
                    )}
                    {attritionPrediction && (
                        <div className="p-4 rounded-xl bg-card border border-red-500/15">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3" /> Flight Risk Analysis
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="p-3 rounded-lg bg-secondary/30">
                                    <span className="text-[10px] font-medium text-muted-foreground">Flight Risk</span>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-lg font-bold ${attritionPrediction.flightRisk >= 70 ? "text-red-500" : attritionPrediction.flightRisk >= 40 ? "text-amber-500" : "text-emerald-500"}`}>
                                            {attritionPrediction.flightRisk}%
                                        </p>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${attritionPrediction.riskLevel === "High" ? "bg-red-500/15 text-red-600 border-red-500/30" : attritionPrediction.riskLevel === "Medium" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"}`}>
                                            {attritionPrediction.riskLevel}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${attritionPrediction.flightRisk}%` }}
                                            transition={{ duration: 0.8 }}
                                            className={`h-full rounded-full ${attritionPrediction.flightRisk >= 70 ? "bg-red-500" : attritionPrediction.flightRisk >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        />
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-secondary/30">
                                    <span className="text-[10px] font-medium text-muted-foreground">Impact Score</span>
                                    <div className="flex items-center gap-2">
                                        <p className="text-lg font-bold text-blue-500">{attritionPrediction.impactScore}%</p>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${attritionPrediction.impactLevel === "High" ? "bg-blue-500/15 text-blue-600 border-blue-500/30" : attritionPrediction.impactLevel === "Medium" ? "bg-indigo-500/15 text-indigo-600 border-indigo-500/30" : "bg-slate-500/15 text-slate-600 border-slate-500/30"}`}>
                                            {attritionPrediction.impactLevel}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${attritionPrediction.impactScore}%` }}
                                            transition={{ duration: 0.8 }}
                                            className="h-full rounded-full bg-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="p-3 rounded-lg bg-secondary/20">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Sparkles className="h-2.5 w-2.5 text-violet-500" /> AI Analysis
                                    </p>
                                    <p className="text-xs text-muted-foreground leading-relaxed italic">{attritionPrediction.rationale}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Zap className="h-2.5 w-2.5" /> Recommendation
                                    </p>
                                    <p className="text-xs font-medium text-foreground leading-relaxed">{attritionPrediction.recommendation}</p>
                                </div>
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
    onToggleActionable, attritionPredictions, attritionLoading, onGenerateAttrition, actionableProgress,
}: EmployeeSuggestionsTabProps) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [talentProfileId, setTalentProfileId] = useState<string | null>(null);
    const [coachEmployeeId, setCoachEmployeeId] = useState<string | null>(null);
    const [activeKpiAction, setActiveKpiAction] = useState<ActiveKpiAction | null>(null);
    const [pendingById, setPendingById] = useState<Record<string, boolean>>({});

    const handleToggle = async (
        actionableId: string,
        completed: boolean,
        completion?: {
            impact?: EmployeeActionableImpact;
            completionMetric?: string;
            completionNote?: string;
            formData?: Record<string, unknown>;
        }
    ) => {
        setPendingById((prev) => ({ ...prev, [actionableId]: true }));
        try {
            await onToggleActionable(actionableId, completed, completion);
        } finally {
            setPendingById((prev) => ({ ...prev, [actionableId]: false }));
        }
    };

    const handleCompleteKpiAction = async (
        actionableId: string,
        impact: EmployeeActionableImpact,
        completionMetric: string,
        completionNote: string,
        formData: Record<string, unknown>
    ) => {
        await handleToggle(actionableId, true, { impact, completionMetric, completionNote, formData });
        setActiveKpiAction(null);
    };

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
    const talentAttrition = talentProfile
        ? attritionPredictions.find(p => p.employeeName === talentProfile.name) || null
        : null;

    return (
        <div className="space-y-5">
            {/* ── Team Metrics Summary Bar ── */}
            {teamMetrics && (
                <div className="grid grid-cols-3 gap-3">
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
                            <Heart className="h-3.5 w-3.5 text-pink-500" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engagement</span>
                        </div>
                        <p className={`text-xl font-bold ${getScoreColor(teamMetrics.engagementScore)}`}>
                            {teamMetrics.engagementScore}%
                        </p>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Employee Coaching</h3>
                    <p className="text-sm text-muted-foreground">
                        {coachingProfiles.length} team members · Score: <span className="font-semibold text-foreground">{currentScore}%</span>
                    </p>
                    {actionableProgress && actionableProgress.total > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Actionables completed: <span className="font-semibold text-foreground">{actionableProgress.completed}/{actionableProgress.total}</span> ({actionableProgress.completionRate}%)
                        </p>
                    )}
                </div>
                {loading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs">Generating coaching insights...</span>
                    </div>
                )}
            </div>

            {/* ── Employee Cards ── */}
            <div className="space-y-3">
                {coachingProfiles.map((emp, i) => {
                    const isExpanded = expandedIndex === i;
                    const empSuggestion = employeeSuggestions.find(s => s.employeeName === emp.name);
                    const empAttrition = attritionPredictions.find(p => p.employeeName === emp.name);

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
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-foreground text-sm truncate">{emp.name}</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setTalentProfileId(emp._id); }}
                                            className="px-2 py-0.5 rounded-md border border-blue-500/20 bg-blue-500/5 text-[10px] font-medium text-blue-600 hover:bg-blue-500/10 transition-colors flex items-center gap-1 shrink-0"
                                        >
                                            <Eye className="h-2.5 w-2.5" />
                                            Talent Profile
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setCoachEmployeeId(emp._id); }}
                                            className="px-2 py-0.5 rounded-md border border-violet-500/20 bg-violet-500/5 text-[10px] font-medium text-violet-600 hover:bg-violet-500/10 transition-colors flex items-center gap-1 shrink-0"
                                        >
                                            <Sparkles className="h-2.5 w-2.5" />
                                            <Bot className="h-2.5 w-2.5" />
                                            Coach
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                                </div>

                                {/* Key metric badges */}
                                <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
                                    {/* Employee Effectiveness Score */}
                                    {(() => {
                                        const empAttritionVal = attritionPredictions.find(p => p.employeeName === emp.name);
                                        const ees = computeEmployeeEffectivenessScore(emp, empAttritionVal?.flightRisk);
                                        return (
                                            <div className="flex items-center gap-1" title="Employee Effectiveness Score">
                                                <Zap className={`h-3 w-3 ${getScoreColor(ees)}`} />
                                                <span className={`text-xs font-bold ${getScoreColor(ees)}`}>
                                                    {ees}%
                                                </span>
                                                <span className="text-[9px] text-muted-foreground font-medium hidden sm:inline">EES</span>
                                            </div>
                                        );
                                    })()}

                                    {/* Risk badge */}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskColors[emp.riskLevel]}`}>
                                        {emp.riskLevel}
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
                                            <div className="grid grid-cols-3 gap-2">
                                                {(() => {
                                                    return [
                                                        { label: "Achievement", value: `${emp.achievementScore}%`, bar: emp.achievementScore },
                                                        { label: "Run Rate", value: `${emp.runRate}%`, bar: emp.runRate },
                                                        { label: "Flight Risk", value: `${empAttrition?.flightRisk ?? emp.attritionRisk}%`, bar: empAttrition?.flightRisk ?? emp.attritionRisk },
                                                        { label: "Impact Score", value: `${empAttrition?.impactScore ?? 0}%`, bar: empAttrition?.impactScore ?? 0 },
                                                        { label: "Sentiment", value: `${Math.round(emp.feedbackSentiment * 100)}%`, bar: emp.feedbackSentiment * 100 },
                                                        { label: "Rating", value: `${emp.performanceRating}/5`, bar: (emp.performanceRating / 5) * 100 },
                                                        { label: "Feedbacks", value: `${emp.feedbackCount}`, bar: Math.min(100, emp.feedbackCount * 20) },
                                                    ];
                                                })().map((m, mi) => (
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
                                                    <div className="space-y-2">
                                                        {empSuggestion.suggestions.slice(0, 3).map((sug, si) => (
                                                            <div key={si} className="flex items-start gap-2">
                                                                <BarChart3 className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <TouchpointAction
                                                                        suggestion={sug}
                                                                        pendingById={pendingById}
                                                                        onAct={(suggestion, actionable) => setActiveKpiAction({ suggestion, actionable })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {!empSuggestion && loading && (
                                                <div className="p-3 rounded-lg bg-secondary/30 border border-border flex items-center justify-center gap-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                                    <p className="text-xs text-muted-foreground">Generating coaching insights...</p>
                                                </div>
                                            )}


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
                        attritionPrediction={talentAttrition}
                        attritionLoading={attritionLoading}
                        onClose={() => setTalentProfileId(null)}
                    />
                )}
            </AnimatePresence>

            {/* Performance Coach Modal */}
            <AnimatePresence>
                {coachEmployeeId && (() => {
                    const coachEmp = coachingProfiles.find(e => e._id === coachEmployeeId);
                    const coachSugs = coachEmp ? employeeSuggestions.find(s => s.employeeName === coachEmp.name) : null;
                    const coachAttr = coachEmp ? attritionPredictions.find(p => p.employeeName === coachEmp.name) : null;
                    if (!coachEmp) return null;
                    return (
                        <div className="fixed inset-0 z-50 flex justify-end">
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCoachEmployeeId(null)} />
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
                                                <h3 className="font-display text-lg font-semibold text-foreground">Performance Coach</h3>
                                                <p className="text-xs text-muted-foreground">Coaching {coachEmp.name} · {coachEmp.role}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setCoachEmployeeId(null)} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                                            <X className="h-5 w-5 text-muted-foreground" />
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Employee snapshot */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: "Achievement", value: `${coachEmp.achievementScore}%`, color: getScoreColor(coachEmp.achievementScore) },
                                            { label: "Run Rate", value: `${coachEmp.runRate}%`, color: getScoreColor(coachEmp.runRate) },
                                            { label: "Flight Risk", value: `${coachAttr?.flightRisk ?? coachEmp.attritionRisk}%`, color: (coachAttr?.flightRisk ?? coachEmp.attritionRisk) >= 70 ? "text-red-500" : (coachAttr?.flightRisk ?? coachEmp.attritionRisk) >= 40 ? "text-amber-500" : "text-emerald-500" },
                                            { label: "Sentiment", value: `${Math.round(coachEmp.feedbackSentiment * 100)}%`, color: getScoreColor(coachEmp.feedbackSentiment * 100) },
                                        ].map((m, mi) => (
                                            <div key={mi} className="p-2 rounded-lg bg-secondary/30 text-center">
                                                <span className="text-[9px] font-medium text-muted-foreground uppercase">{m.label}</span>
                                                <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* AI Coach Conversation */}
                                    <div className="space-y-3">
                                        {/* System intro message */}
                                        <div className="flex items-start gap-3">
                                            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
                                                <Bot className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div className="flex-1 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                                <p className="text-sm text-foreground leading-relaxed">
                                                    Hi! I've analyzed <strong>{coachEmp.name}</strong>'s performance data. Here's my coaching assessment:
                                                </p>
                                            </div>
                                        </div>

                                        {/* Risk assessment */}
                                        {coachAttr && (
                                            <div className="flex items-start gap-3">
                                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                        <AlertTriangle className="h-2.5 w-2.5" /> Risk Assessment
                                                    </p>
                                                    <p className="text-sm text-muted-foreground leading-relaxed italic">{coachAttr.rationale}</p>
                                                    <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Recommendation</p>
                                                        <p className="text-xs font-medium text-foreground">{coachAttr.recommendation}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Coaching touchpoints */}
                                        {coachSugs && coachSugs.suggestions.length > 0 && (
                                            <div className="flex items-start gap-3">
                                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                        <Sparkles className="h-2.5 w-2.5" /> Coaching Action Plan
                                                    </p>
                                                    {coachSugs.rationale && (
                                                        <p className="text-xs text-muted-foreground mb-2 italic">{coachSugs.rationale}</p>
                                                    )}
                                                    <div className="space-y-2">
                                                        {coachSugs.suggestions.map((sug, si) => (
                                                            <motion.div
                                                                key={si}
                                                                initial={{ opacity: 0, y: 4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: si * 0.1 }}
                                                                className="p-2.5 rounded-lg bg-card border border-border"
                                                            >
                                                                <div className="flex items-start gap-1.5">
                                                                    <Zap className="h-3 w-3 text-violet-500 mt-1 shrink-0" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <TouchpointAction
                                                                            suggestion={sug}
                                                                            pendingById={pendingById}
                                                                            onAct={(suggestion, actionable) => setActiveKpiAction({ suggestion, actionable })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Loading state */}
                                        {loading && !coachSugs && (
                                            <div className="flex items-start gap-3">
                                                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-white" />
                                                </div>
                                                <div className="flex-1 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 flex items-center gap-2">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                                                    <span className="text-sm text-muted-foreground">Analyzing performance data...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Input area — future interactive chat */}
                                <div className="border-t border-border p-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            disabled
                                            placeholder={`Ask about ${coachEmp.name}'s performance...`}
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
                                    <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">Interactive coaching chat coming soon</p>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            <AnimatePresence>
                {activeKpiAction && (
                    <KpiActionModal
                        action={activeKpiAction}
                        pending={pendingById[activeKpiAction.actionable.id] === true}
                        onClose={() => setActiveKpiAction(null)}
                        onComplete={handleCompleteKpiAction}
                    />
                )}
            </AnimatePresence>

        </div>
    );
};

export default EmployeeSuggestionsTab;
