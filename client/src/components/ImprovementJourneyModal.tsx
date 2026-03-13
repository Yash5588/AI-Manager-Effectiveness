import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Rocket, X, AlertTriangle, ChevronDown, ChevronRight,
    Target, Loader2, Trophy, Zap, Clock, Sparkles,
} from "lucide-react";
import { fetchImprovementRoadmap, type ImprovementRoadmapItem, type Manager } from "@/lib/api";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    manager: Manager;
}

const impactColors: Record<string, string> = {
    high: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    low: "bg-blue-500/15 text-blue-600 border-blue-500/30",
};

const impactIcons: Record<string, string> = {
    high: "⚡",
    medium: "🔄",
    low: "📌",
};

const ImprovementJourneyModal = ({ isOpen, onClose, manager }: Props) => {
    const [roadmap, setRoadmap] = useState<ImprovementRoadmapItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isCached, setIsCached] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadRoadmap = async (regenerate: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetchImprovementRoadmap(manager._id, regenerate);
            setRoadmap(result.roadmap);
            setMessage(result.message || null);
            setIsCached(result.cached === true);
            setLoaded(true);
            if (result.roadmap.length > 0) {
                setExpandedMetric(result.roadmap[0].metricKey);
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || "Failed to generate roadmap");
        } finally {
            setLoading(false);
        }
    };

    // Auto-load when modal opens (serves cached if available)
    useEffect(() => {
        if (isOpen && !loaded && !loading) {
            loadRoadmap(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const totalWeeks = roadmap.length > 0
        ? Math.max(...roadmap.map(r => r.estimatedWeeks))
        : 0;

    const criticalCount = roadmap.filter(r => r.severity === "critical").length;
    const warningCount = roadmap.filter(r => r.severity === "warning").length;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20">
                                <Rocket className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-foreground">
                                    Improvement Journey
                                </h3>
                                <p className="text-[10px] text-muted-foreground">
                                    AI-generated roadmap for weak metrics
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors"
                        >
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Not yet loaded — Generate button */}
                    {!loaded && !loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="relative">
                                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-violet-500/20 flex items-center justify-center">
                                    <Sparkles className="h-10 w-10 text-violet-500" />
                                </div>
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center"
                                >
                                    <Zap className="h-2.5 w-2.5 text-white" />
                                </motion.div>
                            </div>
                            <div className="text-center max-w-xs">
                                <h4 className="font-display text-base font-semibold text-foreground mb-1">
                                    Ready to Improve?
                                </h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    AI will analyze your weak metrics, predict why they're low, and create
                                    a step-by-step improvement roadmap with touchpoints.
                                </p>
                            </div>
                            <button
                                onClick={() => loadRoadmap(false)}
                                className="mt-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-pink-600 text-white font-medium text-sm hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-violet-500/25"
                            >
                                <Rocket className="h-4 w-4" />
                                Generate Improvement Roadmap
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                            <div className="text-center">
                                <p className="text-sm font-medium text-foreground">Analyzing weak metrics...</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Predicting reasons & generating touchpoints
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
                            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-2" />
                            <p className="text-sm text-destructive font-medium">{error}</p>
                            <button
                                onClick={() => loadRoadmap(false)}
                                className="mt-3 px-4 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* All healthy */}
                    {loaded && roadmap.length === 0 && message && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Trophy className="h-8 w-8 text-emerald-500" />
                            </div>
                            <h4 className="font-display text-base font-semibold text-emerald-600">
                                All Metrics Healthy! 🎉
                            </h4>
                            <p className="text-sm text-muted-foreground text-center max-w-xs">
                                {message}
                            </p>
                        </div>
                    )}

                    {/* Roadmap loaded */}
                    {loaded && roadmap.length > 0 && (
                        <>
                            {/* Summary badges */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border">
                                    <Target className="h-3.5 w-3.5 text-violet-500" />
                                    <span className="text-xs font-bold text-foreground">{roadmap.length} weak metrics</span>
                                </div>
                                {criticalCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        <span className="text-xs font-bold text-red-600">{criticalCount} critical</span>
                                    </div>
                                )}
                                {warningCount > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        <span className="text-xs font-bold text-amber-600">{warningCount} warning</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 border border-border">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-bold text-foreground">~{totalWeeks} weeks</span>
                                </div>
                                {isCached && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                                        <span className="text-[10px] font-bold text-violet-600">📦 Cached</span>
                                    </div>
                                )}
                            </div>

                            {/* Overall quest progress bar */}
                            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/5 to-pink-500/5 border border-violet-500/15">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Quest Progress
                                    </span>
                                    <span className="text-xs font-bold text-violet-600">
                                        {manager.effectivenessScore}% → {Math.min(100, manager.effectivenessScore + roadmap.length * 5)}% est.
                                    </span>
                                </div>
                                <div className="relative h-3 rounded-full bg-secondary/60 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${manager.effectivenessScore}%` }}
                                        transition={{ duration: 1, delay: 0.3 }}
                                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                                    />
                                    {/* Milestone markers */}
                                    {roadmap.map((item, i) => {
                                        const pos = Math.min(95, item.milestoneTarget);
                                        return (
                                            <motion.div
                                                key={item.metricKey}
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.5 + i * 0.15 }}
                                                className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center text-[8px]"
                                                style={{ left: `${pos}%`, transform: `translateX(-50%) translateY(-50%)` }}
                                                title={item.metricLabel}
                                            >
                                                <div className={`h-full w-full rounded-full flex items-center justify-center ${item.severity === "critical" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                                                    }`}>
                                                    {i + 1}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                    {/* Trophy at end */}
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Per-metric accordion */}
                            <div className="space-y-3">
                                {roadmap.map((item, index) => {
                                    const isExpanded = expandedMetric === item.metricKey;
                                    const isCritical = item.severity === "critical";
                                    const borderColor = isCritical ? "border-red-500/30" : "border-amber-500/30";
                                    const bgColor = isCritical ? "bg-red-500/5" : "bg-amber-500/5";

                                    return (
                                        <motion.div
                                            key={item.metricKey}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.08 }}
                                            className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}
                                        >
                                            {/* Metric header (clickable) */}
                                            <button
                                                onClick={() => setExpandedMetric(isExpanded ? null : item.metricKey)}
                                                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${isCritical ? "bg-red-500" : "bg-amber-500"
                                                        }`}>
                                                        {item.currentScore}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-semibold text-foreground truncate">
                                                            {item.metricLabel}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isCritical ? "text-red-600" : "text-amber-600"
                                                                }`}>
                                                                {item.severity}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                → target: {item.milestoneTarget} in ~{item.estimatedWeeks}w
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded
                                                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                }
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
                                                        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
                                                            {/* Why is this low? */}
                                                            {item.predictedReasons.length > 0 && (
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                        <AlertTriangle className="h-3 w-3" />
                                                                        Why is this low?
                                                                    </p>
                                                                    <ul className="space-y-1.5">
                                                                        {item.predictedReasons.map((reason, ri) => (
                                                                            <li key={ri} className="flex items-start gap-2 text-sm text-foreground/85">
                                                                                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isCritical ? "bg-red-500" : "bg-amber-500"
                                                                                    }`} />
                                                                                {reason}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}

                                                            {/* Overarching suggestion */}
                                                            {item.suggestion && (
                                                                <div className="p-3 rounded-lg bg-violet-500/8 border border-violet-500/15">
                                                                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                        <Sparkles className="h-3 w-3" /> Recommendation
                                                                    </p>
                                                                    <p className="text-sm text-foreground/90 font-medium">
                                                                        {item.suggestion}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* Touchpoint timeline */}
                                                            {item.touchpoints.length > 0 && (
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                                                        <Target className="h-3 w-3" />
                                                                        Touchpoints & Actions
                                                                    </p>
                                                                    <div className="relative pl-6">
                                                                        {/* Timeline line */}
                                                                        <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gradient-to-b from-violet-500/40 to-pink-500/40 rounded-full" />

                                                                        {item.touchpoints.map((tp, ti) => (
                                                                            <motion.div
                                                                                key={ti}
                                                                                initial={{ opacity: 0, x: -8 }}
                                                                                animate={{ opacity: 1, x: 0 }}
                                                                                transition={{ delay: ti * 0.1 }}
                                                                                className="relative mb-3 last:mb-0"
                                                                            >
                                                                                {/* Timeline dot */}
                                                                                <motion.div
                                                                                    animate={{ scale: [1, 1.3, 1] }}
                                                                                    transition={{ repeat: Infinity, duration: 2, delay: ti * 0.3 }}
                                                                                    className={`absolute -left-6 top-1 h-[14px] w-[14px] rounded-full border-2 border-background ${tp.impact === "high" ? "bg-emerald-500"
                                                                                        : tp.impact === "medium" ? "bg-amber-500"
                                                                                            : "bg-blue-500"
                                                                                        }`}
                                                                                />

                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                                            <span className="text-[10px] font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                                                                                                Week {tp.week}
                                                                                            </span>
                                                                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${impactColors[tp.impact]}`}>
                                                                                                {impactIcons[tp.impact]} {tp.impact}
                                                                                            </span>
                                                                                        </div>
                                                                                        <p className="text-sm text-foreground/85 leading-relaxed">
                                                                                            {tp.action}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </motion.div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Milestone progress */}
                                                            <div className="pt-2">
                                                                <div className="flex items-center justify-between text-[10px] mb-1.5">
                                                                    <span className="font-bold text-muted-foreground uppercase tracking-wider">
                                                                        Milestone Target
                                                                    </span>
                                                                    <span className="font-bold text-violet-600">
                                                                        {item.currentScore} → {item.milestoneTarget}
                                                                    </span>
                                                                </div>
                                                                <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${item.currentScore}%` }}
                                                                        transition={{ duration: 0.8 }}
                                                                        className={`h-full rounded-full ${isCritical ? "bg-red-500" : "bg-amber-500"
                                                                            }`}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between mt-1">
                                                                    <span className="text-[10px] text-muted-foreground">Current</span>
                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                        <Clock className="h-2.5 w-2.5" />
                                                                        ~{item.estimatedWeeks} weeks
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Regenerate button */}
                            <div className="pt-2 pb-4 flex justify-center">
                                <button
                                    onClick={() => loadRoadmap(true)}
                                    disabled={loading}
                                    className="px-4 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                                    Regenerate Roadmap
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ImprovementJourneyModal;
