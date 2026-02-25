import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    LogOut,
    Send,
    Loader2,
    MessageSquare,
    CheckCircle2,
    Clock,
    TrendingUp,
} from "lucide-react";
import api from "@/lib/api";

interface SubmittedFeedback {
    _id: string;
    comment: string;
    sentimentScore: number;
    managerName: string;
    createdAt: string;
}

function getSentimentLabel(score: number): string {
    if (score >= 0.6) return "Positive";
    if (score <= 0.4) return "Negative";
    return "Neutral";
}

function getSentimentColor(score: number): string {
    if (score >= 0.6) return "text-success";
    if (score <= 0.4) return "text-destructive";
    return "text-accent";
}

function getSentimentBg(score: number): string {
    if (score >= 0.6) return "bg-success/15 text-success";
    if (score <= 0.4) return "bg-destructive/15 text-destructive";
    return "bg-accent/15 text-accent";
}

const EmployeeFeedback = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [lastResult, setLastResult] = useState<{
        sentimentScore: number;
        comment: string;
    } | null>(null);
    const [pastFeedbacks, setPastFeedbacks] = useState<SubmittedFeedback[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Load past feedbacks
    useEffect(() => {
        loadPastFeedbacks();
    }, []);

    const loadPastFeedbacks = async () => {
        try {
            const res = await api.get("/feedback/my-feedbacks");
            setPastFeedbacks(res.data);
        } catch (err) {
            console.error("Failed to load feedback history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;

        setSubmitting(true);
        setError("");
        setSuccess(false);
        setLastResult(null);

        try {
            const res = await api.post("/feedback/submit", { comment: comment.trim() });
            setSuccess(true);
            setLastResult({
                sentimentScore: res.data.feedback.sentimentScore,
                comment: res.data.feedback.comment,
            });
            setComment("");
            // Reload history
            loadPastFeedbacks();
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

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-auto flex items-center justify-center">
                            <img src="/darwinbox-logo.png" alt="Darwinbox" className="h-8 w-auto object-contain" />
                        </div>
                        <div>
                            <h1 className="font-display text-lg font-bold text-foreground leading-none">
                                Manager Feedback
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Share your thoughts about your manager
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-foreground">{user?.name}</p>
                            <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
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
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-display text-xl font-bold text-foreground">
                                Submit Feedback
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Your feedback helps improve management effectiveness. AI will analyze the sentiment automatically.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Your Feedback
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Share your honest feedback about your manager's communication, leadership, support, or any other aspect..."
                                rows={5}
                                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                required
                                disabled={submitting}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                {comment.length} characters
                            </p>
                        </div>

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
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="h-5 w-5 text-success" />
                                    <span className="text-sm font-medium text-success">
                                        Feedback submitted successfully!
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-muted-foreground">AI Sentiment Score:</span>
                                    <span className={`font-bold text-lg ${getSentimentColor(lastResult.sentimentScore)}`}>
                                        {Math.round(lastResult.sentimentScore * 100)}%
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSentimentBg(lastResult.sentimentScore)}`}>
                                        {getSentimentLabel(lastResult.sentimentScore)}
                                    </span>
                                </div>
                            </motion.div>
                        )}

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
                                    Submit Feedback
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
                                    className="p-4 rounded-lg bg-secondary/50 border border-border/50"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">
                                                To: <span className="text-foreground font-medium">{fb.managerName}</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSentimentBg(fb.sentimentScore)}`}>
                                                {getSentimentLabel(fb.sentimentScore)} ({Math.round(fb.sentimentScore * 100)}%)
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(fb.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-foreground">{fb.comment}</p>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>
        </div>
    );
};

export default EmployeeFeedback;
