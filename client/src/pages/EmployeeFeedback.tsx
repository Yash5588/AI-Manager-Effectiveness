import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    LogOut,
    Send,
    Loader2,
    MessageSquare,
    CheckCircle2,
    Clock,
    TrendingUp,
    Star,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    ThumbsUp,
    Lightbulb,
    Gauge,
    Users,
    CalendarClock,
    Shield,
} from "lucide-react";
import api from "@/lib/api";

/* ─── Types ─── */
interface Ratings {
    communication: number;
    recognition: number;
    availability: number;
    careerGrowth: number;
    empowerment: number;
    fairness: number;
    decisionMaking: number;
    conflictResolution: number;
}

interface SubmittedFeedback {
    _id: string;
    comment: string;
    sentimentScore: number;
    compositeFeedbackScore?: number;
    ratings?: Ratings;
    npsScore?: number;
    pulseMood?: string;
    feedbackCategory?: string;
    feedbackType?: string;
    managerName: string;
    createdAt: string;
}

/* ─── Helpers ─── */
function getSentimentLabel(score: number): string {
    if (score >= 0.6) return "Positive";
    if (score <= 0.4) return "Negative";
    return "Neutral";
}

function getSentimentBg(score: number): string {
    if (score >= 0.6) return "bg-success/15 text-success";
    if (score <= 0.4) return "bg-destructive/15 text-destructive";
    return "bg-accent/15 text-accent";
}

const PULSE_MOODS = [
    { value: "thriving", emoji: "🔥", label: "Thriving" },
    { value: "happy", emoji: "😊", label: "Happy" },
    { value: "neutral", emoji: "😐", label: "Neutral" },
    { value: "stressed", emoji: "😓", label: "Stressed" },
    { value: "struggling", emoji: "😞", label: "Struggling" },
];

const RATING_DIMENSIONS: { key: keyof Ratings; label: string; icon: string }[] = [
    { key: "communication", label: "Communication Clarity", icon: "💬" },
    { key: "recognition", label: "Recognition & Appreciation", icon: "🏆" },
    { key: "availability", label: "Availability & Accessibility", icon: "🚪" },
    { key: "careerGrowth", label: "Career Growth Support", icon: "📈" },
    { key: "empowerment", label: "Empowerment & Autonomy", icon: "💪" },
    { key: "fairness", label: "Fairness & Inclusion", icon: "⚖️" },
    { key: "decisionMaking", label: "Decision Making", icon: "🎯" },
    { key: "conflictResolution", label: "Conflict Resolution", icon: "🤝" },
];

const CATEGORIES = [
    { value: "communication", label: "Communication" },
    { value: "leadership", label: "Leadership" },
    { value: "technical", label: "Technical" },
    { value: "culture", label: "Culture" },
    { value: "growth", label: "Growth" },
    { value: "worklife", label: "Work-Life Balance" },
    { value: "other", label: "Other" },
];

const FEEDBACK_TYPES = [
    { value: "appreciation", label: "Appreciation", icon: <ThumbsUp className="h-4 w-4" />, color: "border-green-500/50 bg-green-500/10 text-green-400" },
    { value: "suggestion", label: "Suggestion", icon: <Lightbulb className="h-4 w-4" />, color: "border-amber-500/50 bg-amber-500/10 text-amber-400" },
    { value: "concern", label: "Concern", icon: <AlertTriangle className="h-4 w-4" />, color: "border-red-500/50 bg-red-500/10 text-red-400" },
];

const ONE_ON_ONE_OPTIONS = [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "rarely", label: "Rarely" },
    { value: "never", label: "Never" },
];

const FEEDBACK_FREQ_OPTIONS = [
    { value: "after_every_task", label: "After Every Task" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "rarely", label: "Rarely" },
    { value: "never", label: "Never" },
];

const RESPONSE_TIME_OPTIONS = [
    { value: "same_day", label: "Same Day" },
    { value: "within_week", label: "Within a Week" },
    { value: "within_month", label: "Within a Month" },
    { value: "rarely", label: "Rarely Addressed" },
    { value: "never", label: "Never Addressed" },
];

const PEER_COMPARISON_OPTIONS = [
    { value: "much_better", label: "Much Better" },
    { value: "better", label: "Better" },
    { value: "same", label: "About the Same" },
    { value: "worse", label: "Worse" },
    { value: "much_worse", label: "Much Worse" },
];

const TIME_PERIOD_OPTIONS = [
    { value: "last_week", label: "Last Week" },
    { value: "last_month", label: "Last Month" },
    { value: "last_quarter", label: "Last Quarter" },
    { value: "overall", label: "Overall" },
];

const URGENCY_OPTIONS = [
    { value: "low", label: "Low", color: "border-green-500/50 bg-green-500/10 text-green-400" },
    { value: "medium", label: "Medium", color: "border-amber-500/50 bg-amber-500/10 text-amber-400" },
    { value: "high", label: "High", color: "border-red-500/50 bg-red-500/10 text-red-400" },
];

/* ─── Star Rating Component ─── */
const StarRating = ({
    value,
    onChange,
    disabled,
}: {
    value: number;
    onChange: (v: number) => void;
    disabled: boolean;
}) => {
    const [hovered, setHovered] = useState(0);

    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={disabled}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => onChange(star)}
                    className="transition-transform hover:scale-110 disabled:cursor-not-allowed"
                >
                    <Star
                        className={`h-5 w-5 transition-colors ${star <= (hovered || value)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                            }`}
                    />
                </button>
            ))}
        </div>
    );
};

/* ─── NPS Slider ─── */
const NPSSlider = ({
    value,
    onChange,
    disabled,
}: {
    value: number;
    onChange: (v: number) => void;
    disabled: boolean;
}) => {
    const getNPSColor = (v: number) => {
        if (v >= 9) return "bg-green-500";
        if (v >= 7) return "bg-green-400";
        if (v >= 5) return "bg-amber-400";
        if (v >= 3) return "bg-orange-400";
        return "bg-red-500";
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Not likely</span>
                <span className={`text-lg font-bold px-3 py-0.5 rounded-full ${getNPSColor(value)} text-white`}>
                    {value}
                </span>
                <span className="text-xs text-muted-foreground">Extremely likely</span>
            </div>
            <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                        key={n}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(n)}
                        className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${n === value
                            ? `${getNPSColor(n)} text-white scale-110 ring-2 ring-white/30`
                            : n <= value
                                ? `${getNPSColor(n)}/30 text-foreground`
                                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                            } disabled:cursor-not-allowed`}
                    >
                        {n}
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─── Section Wrapper ─── */
const FormSection = ({
    title,
    subtitle,
    icon,
    children,
    badge,
}: {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    badge?: string;
}) => (
    <div className="space-y-4 p-5 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                    {badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                            {badge}
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
        </div>
        {children}
    </div>
);

/* ─── Main Component ─── */
const EmployeeFeedback = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Form state
    const [comment, setComment] = useState("");
    const [ratings, setRatings] = useState<Ratings>({
        communication: 0, recognition: 0, availability: 0, careerGrowth: 0,
        empowerment: 0, fairness: 0, decisionMaking: 0, conflictResolution: 0,
    });
    const [npsScore, setNpsScore] = useState(5);
    const [feedbackCategory, setFeedbackCategory] = useState("");
    const [feedbackType, setFeedbackType] = useState("");
    const [pulseMood, setPulseMood] = useState("");
    const [oneOnOneFrequency, setOneOnOneFrequency] = useState("");
    const [feedbackFrequency, setFeedbackFrequency] = useState("");
    const [concernResponseTime, setConcernResponseTime] = useState("");
    const [peerComparison, setPeerComparison] = useState("");
    const [timePeriod, setTimePeriod] = useState("");
    const [urgency, setUrgency] = useState("");
    const [willingToFollowUp, setWillingToFollowUp] = useState(false);

    // UI state
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState<{
        sentimentScore: number;
        compositeFeedbackScore?: number;
        comment: string;
    } | null>(null);
    const [pastFeedbacks, setPastFeedbacks] = useState<SubmittedFeedback[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
    const [feedbackPage, setFeedbackPage] = useState(1);
    const [feedbackTotalPages, setFeedbackTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        loadPastFeedbacks(1, true);
    }, []);

    const loadPastFeedbacks = async (page = 1, reset = false) => {
        try {
            if (page > 1) setLoadingMore(true);
            const res = await api.get(`/feedback/my-feedbacks?page=${page}&limit=20`);
            const data = res.data;
            // Handle both paginated and legacy response formats
            const feedbackList = data.feedbacks ?? data;
            const pagination = data.pagination;

            if (reset) {
                setPastFeedbacks(Array.isArray(feedbackList) ? feedbackList : []);
            } else {
                setPastFeedbacks(prev => [...prev, ...(Array.isArray(feedbackList) ? feedbackList : [])]);
            }

            if (pagination) {
                setFeedbackPage(pagination.page);
                setFeedbackTotalPages(pagination.totalPages);
            }
        } catch (err) {
            console.error("Failed to load feedback history:", err);
        } finally {
            setLoadingHistory(false);
            setLoadingMore(false);
        }
    };

    const resetForm = () => {
        setComment("");
        setRatings({ communication: 0, recognition: 0, availability: 0, careerGrowth: 0, empowerment: 0, fairness: 0, decisionMaking: 0, conflictResolution: 0 });
        setNpsScore(5);
        setFeedbackCategory("");
        setFeedbackType("");
        setPulseMood("");
        setOneOnOneFrequency("");
        setFeedbackFrequency("");
        setConcernResponseTime("");
        setPeerComparison("");
        setTimePeriod("");
        setUrgency("");
        setWillingToFollowUp(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;

        setSubmitting(true);
        setError("");
        setSuccess(false);
        setLastResult(null);

        // Build payload — only include fields that are set
        const payload: Record<string, unknown> = { comment: comment.trim() };

        // Include ratings if any are filled
        const filledRatings = Object.entries(ratings).filter(([, v]) => v > 0);
        if (filledRatings.length > 0) {
            payload.ratings = Object.fromEntries(filledRatings);
        }

        if (npsScore !== 5) payload.npsScore = npsScore;
        if (feedbackCategory) payload.feedbackCategory = feedbackCategory;
        if (feedbackType) payload.feedbackType = feedbackType;
        if (pulseMood) payload.pulseMood = pulseMood;
        if (oneOnOneFrequency) payload.oneOnOneFrequency = oneOnOneFrequency;
        if (feedbackFrequency) payload.feedbackFrequency = feedbackFrequency;
        if (concernResponseTime) payload.concernResponseTime = concernResponseTime;
        if (peerComparison) payload.peerComparison = peerComparison;
        if (timePeriod) payload.timePeriod = timePeriod;
        if (urgency) payload.urgency = urgency;
        if (willingToFollowUp) payload.willingToFollowUp = willingToFollowUp;

        try {
            const res = await api.post("/feedback/submit", payload);
            setSuccess(true);
            setLastResult({
                sentimentScore: res.data.feedback.sentimentScore,
                compositeFeedbackScore: res.data.feedback.compositeFeedbackScore,
                comment: res.data.feedback.comment,
            });
            resetForm();
            resetForm();
            loadPastFeedbacks(1, true);
        } catch (err: any) {
            setError(err?.response?.data?.message || "Failed to submit feedback");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // Compute form completion percentage
    const filledRatingsCount = Object.values(ratings).filter((v) => v > 0).length;
    const totalFields = 15; // all optional fields
    const filledFields = [
        filledRatingsCount > 0 ? 1 : 0,
        npsScore !== 5 ? 1 : 0,
        feedbackCategory ? 1 : 0,
        feedbackType ? 1 : 0,
        pulseMood ? 1 : 0,
        oneOnOneFrequency ? 1 : 0,
        feedbackFrequency ? 1 : 0,
        concernResponseTime ? 1 : 0,
        peerComparison ? 1 : 0,
        timePeriod ? 1 : 0,
        urgency ? 1 : 0,
        willingToFollowUp ? 1 : 0,
        comment.trim() ? 1 : 0,
    ].reduce((s, v) => s + v, 0);
    const completionPct = Math.round((filledFields / totalFields) * 100);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-24 w-auto flex items-center justify-center">
                            <img
                                src="/darwinbox-logo-clean.png"
                                alt="Darwinbox"
                                className="h-24 w-auto object-contain"
                                style={{ mixBlendMode: "multiply" }}
                            />
                        </div>
                        <div>
                            <h1 className="font-display text-lg font-bold text-foreground leading-none">
                                Manager Feedback
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Share comprehensive feedback about your manager
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-[10px]">
                                    {user.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <div className="text-left hidden sm:block">
                                    <span className="block text-sm font-medium leading-none">{user.name}</span>
                                    <span className="block text-[10px] text-muted-foreground">Employee</span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all text-sm"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="container mx-auto px-6 py-8 max-w-3xl">
                {/* Feedback Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-xl p-8 border border-border mb-8"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-display text-xl font-bold text-foreground">
                                    Submit Feedback
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Multi-dimensional assessment for accurate effectiveness scoring
                                </p>
                            </div>
                        </div>
                        {/* Completion indicator */}
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-secondary overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completionPct}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium">{completionPct}%</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 1. Pulse Mood */}
                        <FormSection
                            title="How are you feeling today?"
                            subtitle="Quick pulse check — this is confidential"
                            icon={<Gauge className="h-5 w-5" />}
                            badge="Pulse"
                        >
                            <div className="flex gap-2 justify-center">
                                {PULSE_MOODS.map((mood) => (
                                    <button
                                        key={mood.value}
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => setPulseMood(pulseMood === mood.value ? "" : mood.value)}
                                        className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all ${pulseMood === mood.value
                                            ? "border-primary bg-primary/15 scale-105 ring-1 ring-primary/30"
                                            : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
                                            } disabled:cursor-not-allowed`}
                                    >
                                        <span className="text-2xl">{mood.emoji}</span>
                                        <span className="text-[11px] font-medium text-muted-foreground">{mood.label}</span>
                                    </button>
                                ))}
                            </div>
                        </FormSection>

                        {/* 2. Feedback Type & Category */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormSection
                                title="Feedback Type"
                                icon={<MessageSquare className="h-5 w-5" />}
                            >
                                <div className="flex gap-2">
                                    {FEEDBACK_TYPES.map((ft) => (
                                        <button
                                            key={ft.value}
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => setFeedbackType(feedbackType === ft.value ? "" : ft.value)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${feedbackType === ft.value
                                                ? ft.color + " ring-1"
                                                : "border-border/50 text-muted-foreground hover:bg-secondary/60"
                                                } disabled:cursor-not-allowed`}
                                        >
                                            {ft.icon}
                                            {ft.label}
                                        </button>
                                    ))}
                                </div>
                            </FormSection>

                            <FormSection
                                title="Topic Category"
                                icon={<Shield className="h-5 w-5" />}
                            >
                                <select
                                    value={feedbackCategory}
                                    onChange={(e) => setFeedbackCategory(e.target.value)}
                                    disabled={submitting}
                                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="">Select category...</option>
                                    {CATEGORIES.map((c) => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </FormSection>
                        </div>

                        {/* 3. Written Feedback */}
                        <FormSection
                            title="Written Feedback"
                            subtitle="Share detailed, honest feedback — AI will analyze the sentiment"
                            icon={<MessageSquare className="h-5 w-5" />}
                            badge="Required"
                        >
                            <div>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Share your honest feedback about your manager's communication, leadership, support, or any other aspect..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                    required
                                    disabled={submitting}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    {comment.length} characters
                                </p>
                            </div>
                        </FormSection>

                        {/* 4. Structured Ratings */}
                        <FormSection
                            title="Rate Your Manager"
                            subtitle="Rate on each dimension (1-5 stars)"
                            icon={<Star className="h-5 w-5" />}
                            badge={`${filledRatingsCount}/8`}
                        >
                            <div className="grid gap-3">
                                {RATING_DIMENSIONS.map((dim) => (
                                    <div
                                        key={dim.key}
                                        className="flex items-center justify-between py-1.5"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">{dim.icon}</span>
                                            <span className="text-sm text-foreground">{dim.label}</span>
                                        </div>
                                        <StarRating
                                            value={ratings[dim.key]}
                                            onChange={(v) => setRatings({ ...ratings, [dim.key]: v })}
                                            disabled={submitting}
                                        />
                                    </div>
                                ))}
                            </div>
                        </FormSection>

                        {/* 5. NPS */}
                        <FormSection
                            title="Manager Recommendation Score"
                            subtitle="How likely are you to recommend this manager to a colleague?"
                            icon={<TrendingUp className="h-5 w-5" />}
                            badge="NPS"
                        >
                            <NPSSlider value={npsScore} onChange={setNpsScore} disabled={submitting} />
                        </FormSection>

                        {/* 6. Advanced Section (collapsible) */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary/50 border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4" />
                                    Behavioral Questions & Additional Context
                                </span>
                                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-4 mt-4">
                                            {/* Behavioral Frequencies */}
                                            <FormSection
                                                title="Behavioral Observations"
                                                subtitle="How often do these happen?"
                                                icon={<CalendarClock className="h-5 w-5" />}
                                            >
                                                <div className="grid gap-4">
                                                    <div>
                                                        <label className="text-xs font-medium text-foreground mb-1.5 block">
                                                            How often do you get 1:1 meetings?
                                                        </label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {ONE_ON_ONE_OPTIONS.map((opt) => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    disabled={submitting}
                                                                    onClick={() => setOneOnOneFrequency(oneOnOneFrequency === opt.value ? "" : opt.value)}
                                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${oneOnOneFrequency === opt.value
                                                                        ? "border-primary bg-primary/15 text-primary"
                                                                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                        }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-foreground mb-1.5 block">
                                                            How often does your manager give you feedback?
                                                        </label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {FEEDBACK_FREQ_OPTIONS.map((opt) => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    disabled={submitting}
                                                                    onClick={() => setFeedbackFrequency(feedbackFrequency === opt.value ? "" : opt.value)}
                                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${feedbackFrequency === opt.value
                                                                        ? "border-primary bg-primary/15 text-primary"
                                                                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                        }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-medium text-foreground mb-1.5 block">
                                                            When you raise a concern, it gets addressed...
                                                        </label>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {RESPONSE_TIME_OPTIONS.map((opt) => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    disabled={submitting}
                                                                    onClick={() => setConcernResponseTime(concernResponseTime === opt.value ? "" : opt.value)}
                                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${concernResponseTime === opt.value
                                                                        ? "border-primary bg-primary/15 text-primary"
                                                                        : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                        }`}
                                                                >
                                                                    {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </FormSection>

                                            {/* Peer Comparison & Time Period */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormSection
                                                    title="Peer Comparison"
                                                    subtitle="vs. other managers you've worked with"
                                                    icon={<Users className="h-5 w-5" />}
                                                >
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {PEER_COMPARISON_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={submitting}
                                                                onClick={() => setPeerComparison(peerComparison === opt.value ? "" : opt.value)}
                                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${peerComparison === opt.value
                                                                    ? "border-primary bg-primary/15 text-primary"
                                                                    : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormSection>

                                                <FormSection
                                                    title="Time Period"
                                                    subtitle="This feedback is about..."
                                                    icon={<Clock className="h-5 w-5" />}
                                                >
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {TIME_PERIOD_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={submitting}
                                                                onClick={() => setTimePeriod(timePeriod === opt.value ? "" : opt.value)}
                                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${timePeriod === opt.value
                                                                    ? "border-primary bg-primary/15 text-primary"
                                                                    : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormSection>
                                            </div>

                                            {/* Urgency & Follow-up */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormSection
                                                    title="Urgency Level"
                                                    icon={<AlertTriangle className="h-5 w-5" />}
                                                >
                                                    <div className="flex gap-2">
                                                        {URGENCY_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={submitting}
                                                                onClick={() => setUrgency(urgency === opt.value ? "" : opt.value)}
                                                                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${urgency === opt.value
                                                                    ? opt.color + " ring-1"
                                                                    : "border-border/50 text-muted-foreground hover:bg-secondary"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormSection>

                                                <FormSection
                                                    title="Follow-up"
                                                    subtitle="Would you be open to a confidential follow-up?"
                                                    icon={<CheckCircle2 className="h-5 w-5" />}
                                                >
                                                    <label className="flex items-center gap-3 cursor-pointer">
                                                        <div className="relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={willingToFollowUp}
                                                                onChange={(e) => setWillingToFollowUp(e.target.checked)}
                                                                disabled={submitting}
                                                                className="sr-only"
                                                            />
                                                            <div className={`w-10 h-6 rounded-full transition-colors ${willingToFollowUp ? "bg-primary" : "bg-secondary"
                                                                }`}>
                                                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${willingToFollowUp ? "translate-x-5" : "translate-x-1"
                                                                    }`} />
                                                            </div>
                                                        </div>
                                                        <span className="text-sm text-foreground">
                                                            {willingToFollowUp ? "Yes, I'm open" : "No, thanks"}
                                                        </span>
                                                    </label>
                                                </FormSection>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Error / Success */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        {success && lastResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-lg bg-success/10 border border-success/20"
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle2 className="h-5 w-5 text-success" />
                                    <span className="text-sm font-medium text-success">
                                        Feedback submitted successfully!
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground text-xs">AI Sentiment Score</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`font-bold text-lg ${lastResult.sentimentScore >= 0.6 ? "text-success" :
                                                lastResult.sentimentScore <= 0.4 ? "text-destructive" : "text-accent"
                                                }`}>
                                                {Math.round(lastResult.sentimentScore * 100)}%
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSentimentBg(lastResult.sentimentScore)}`}>
                                                {getSentimentLabel(lastResult.sentimentScore)}
                                            </span>
                                        </div>
                                    </div>
                                    {lastResult.compositeFeedbackScore != null && (
                                        <div>
                                            <span className="text-muted-foreground text-xs">Composite Score</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`font-bold text-lg ${lastResult.compositeFeedbackScore >= 0.6 ? "text-success" :
                                                    lastResult.compositeFeedbackScore <= 0.4 ? "text-destructive" : "text-accent"
                                                    }`}>
                                                    {Math.round(lastResult.compositeFeedbackScore * 100)}%
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    (blended from all signals)
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={submitting || !comment.trim()}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg gradient-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyzing & Submitting...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Submit Enhanced Feedback
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>

                {/* Past Feedbacks */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card rounded-xl p-8 border border-border"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                            <h2 className="font-display text-xl font-bold text-foreground">
                                Your Feedback History
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {pastFeedbacks.length} feedback{pastFeedbacks.length !== 1 ? "s" : ""} submitted
                            </p>
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : pastFeedbacks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No feedback submitted yet. Share your first feedback above!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pastFeedbacks.map((fb, i) => (
                                <motion.div
                                    key={fb._id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="rounded-lg bg-secondary/50 border border-border/50 overflow-hidden"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpandedHistory(expandedHistory === fb._id ? null : fb._id)}
                                        className="w-full p-4 text-left"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">
                                                    To: <span className="text-foreground font-medium">{fb.managerName}</span>
                                                </span>
                                                {fb.feedbackType && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${fb.feedbackType === "appreciation" ? "bg-green-500/15 text-green-400" :
                                                        fb.feedbackType === "suggestion" ? "bg-amber-500/15 text-amber-400" :
                                                            "bg-red-500/15 text-red-400"
                                                        }`}>
                                                        {fb.feedbackType}
                                                    </span>
                                                )}
                                                {fb.pulseMood && (
                                                    <span className="text-sm">
                                                        {PULSE_MOODS.find(m => m.value === fb.pulseMood)?.emoji}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSentimentBg(fb.compositeFeedbackScore ?? fb.sentimentScore)}`}>
                                                    {getSentimentLabel(fb.compositeFeedbackScore ?? fb.sentimentScore)} ({Math.round((fb.compositeFeedbackScore ?? fb.sentimentScore) * 100)}%)
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(fb.createdAt).toLocaleDateString()}
                                                </span>
                                                {expandedHistory === fb._id ? (
                                                    <ChevronUp className="h-3 w-3 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-sm text-foreground line-clamp-2">{fb.comment}</p>
                                    </button>

                                    <AnimatePresence>
                                        {expandedHistory === fb._id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-border/50 overflow-hidden"
                                            >
                                                <div className="p-4 space-y-3">
                                                    {fb.ratings && (
                                                        <div>
                                                            <p className="text-xs font-medium text-muted-foreground mb-2">Ratings</p>
                                                            <div className="grid grid-cols-2 gap-1.5">
                                                                {Object.entries(fb.ratings)
                                                                    .filter(([, v]) => v != null && v > 0)
                                                                    .map(([key, val]) => {
                                                                        const dim = RATING_DIMENSIONS.find(d => d.key === key);
                                                                        return (
                                                                            <div key={key} className="flex items-center justify-between text-xs">
                                                                                <span className="text-muted-foreground">{dim?.icon} {dim?.label || key}</span>
                                                                                <div className="flex gap-0.5">
                                                                                    {[1, 2, 3, 4, 5].map(s => (
                                                                                        <Star key={s} className={`h-3 w-3 ${s <= (val as number) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        {fb.npsScore != null && (
                                                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">NPS: {fb.npsScore}/10</span>
                                                        )}
                                                        {fb.feedbackCategory && (
                                                            <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400">{fb.feedbackCategory}</span>
                                                        )}
                                                        {fb.sentimentScore != null && (
                                                            <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400">Sentiment: {Math.round(fb.sentimentScore * 100)}%</span>
                                                        )}
                                                        {fb.compositeFeedbackScore != null && (
                                                            <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400">Composite: {Math.round(fb.compositeFeedbackScore * 100)}%</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}

                            {/* Load More Button */}
                            {feedbackPage < feedbackTotalPages && (
                                <button
                                    onClick={() => loadPastFeedbacks(feedbackPage + 1)}
                                    disabled={loadingMore}
                                    className="w-full py-3 mt-4 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                                    Load Older Feedback
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
};

export default EmployeeFeedback;
