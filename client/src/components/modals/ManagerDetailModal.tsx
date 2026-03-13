import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Users,
    MessageSquare,
    Sparkles,
    Star,
    Loader2,
    TrendingUp,
} from "lucide-react";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import {
    fetchEmployees,
    fetchFeedbacks,
    type HRManager,
    type Employee,
    type Feedback,
} from "@/lib/api";
import { extendedMetricLabels } from "@/lib/metricLabels";

function getRatingColor(rating: number) {
    if (rating >= 4) return "text-emerald-400";
    if (rating >= 3) return "text-amber-400";
    return "text-red-400";
}

function getCategoryColor(category: string) {
    if (category === "Excellent") return "text-emerald-400";
    if (category === "Good") return "text-blue-400";
    if (category === "Average") return "text-amber-400";
    return "text-red-400";
}

function getCategoryBg(cat: string) {
    if (cat === "Excellent") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (cat === "Good") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (cat === "Average") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
}

function getSentimentLabel(score: number) {
    if (score >= 0.6) return "Positive";
    if (score <= 0.4) return "Negative";
    return "Neutral";
}

interface ManagerDetailModalProps {
    manager: HRManager | null;
    open: boolean;
    onClose: () => void;
}

const ManagerDetailModal = ({ manager, open, onClose }: ManagerDetailModalProps) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && manager) {
            setLoading(true);
            Promise.all([
                fetchEmployees(manager._id),
                fetchFeedbacks(manager._id),
            ])
                .then(([emps, fbs]) => {
                    setEmployees(emps);
                    setFeedbacks(fbs);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [open, manager?._id]);

    if (!manager) return null;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl overflow-y-auto"
            >
                <SheetHeader className="pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {manager.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                            <SheetTitle className="text-lg">{manager.name}</SheetTitle>
                            <SheetDescription>
                                {manager.department} · {manager.experienceYears}yr Experience
                            </SheetDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        <div className="text-center">
                            <p className={`text-xl font-bold ${getCategoryColor(manager.category)}`}>
                                {manager.effectivenessScore}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">Score</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-foreground">
                                {Math.round(manager.sentimentScore * 100)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">Sentiment</p>
                        </div>
                        <span
                            className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${getCategoryBg(
                                manager.category
                            )}`}
                        >
                            {manager.category}
                        </span>
                    </div>
                </SheetHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-6 pt-4">
                        {/* Score Trend */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-foreground text-sm">Score Trend</h4>
                            </div>
                            <ScoreTrendChart
                                managerId={manager._id}
                                currentScore={manager.effectivenessScore}
                            />
                        </div>

                        {/* KPI Breakdown */}
                        {manager.extendedMetrics &&
                            Object.keys(manager.extendedMetrics).filter(
                                (k) => extendedMetricLabels[k]
                            ).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        <h4 className="font-medium text-foreground text-sm">
                                            6-Dimension KPI Breakdown
                                        </h4>
                                    </div>
                                    <div className="space-y-3">
                                        {Object.entries(manager.extendedMetrics)
                                            .filter(([key]) => extendedMetricLabels[key] !== undefined)
                                            .map(([key, value], i) => {
                                                const isIDP = key === "IDP";
                                                const displayValue = isIDP
                                                    ? `${value} employees`
                                                    : `${String(value)}%`;
                                                const barWidth = isIDP
                                                    ? (Number(value) / 5) * 100
                                                    : Number(value);
                                                return (
                                                    <div key={key} className="space-y-1">
                                                        <div className="flex justify-between text-xs font-semibold">
                                                            <span className="text-muted-foreground">
                                                                {extendedMetricLabels[key]}
                                                            </span>
                                                            <span className="text-foreground">{displayValue}</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${barWidth}%` }}
                                                                transition={{ duration: 0.8, delay: i * 0.05 }}
                                                                className={`h-full rounded-full ${barWidth >= 80
                                                                        ? "bg-emerald-500"
                                                                        : barWidth >= 60
                                                                            ? "bg-primary"
                                                                            : "bg-destructive"
                                                                    }`}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                        {/* Team Members */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-foreground text-sm">
                                    Team Members ({employees.length})
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {employees.map((emp) => (
                                    <div
                                        key={emp._id}
                                        className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                                {emp.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-foreground">
                                                    {emp.name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground capitalize">
                                                    {emp.role}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Star
                                                className={`h-3 w-3 ${getRatingColor(
                                                    emp.performanceRating || 0
                                                )}`}
                                            />
                                            <span
                                                className={`text-xs font-bold ${getRatingColor(
                                                    emp.performanceRating || 0
                                                )}`}
                                            >
                                                {emp.performanceRating}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Feedbacks */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <MessageSquare className="h-4 w-4 text-accent" />
                                <h4 className="font-medium text-foreground text-sm">
                                    Recent Feedbacks ({feedbacks.length})
                                </h4>
                            </div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                {feedbacks.length > 0 ? (
                                    feedbacks.map((fb) => (
                                        <div
                                            key={fb._id}
                                            className="p-2.5 rounded-lg bg-secondary/30 border border-border/50"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                    {fb.fromEmployee}
                                                </span>
                                                <span
                                                    className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${fb.sentimentScore >= 0.6
                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                            : fb.sentimentScore <= 0.4
                                                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                        }`}
                                                >
                                                    {getSentimentLabel(fb.sentimentScore)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground italic leading-relaxed">
                                                "{fb.comment}"
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4">
                                        No feedback available.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default ManagerDetailModal;
