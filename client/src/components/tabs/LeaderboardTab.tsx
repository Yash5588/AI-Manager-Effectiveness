import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Loader2,
    Trophy,
    GitCompareArrows,
    X,
    Target,
    TrendingUp,
    AlertTriangle,
    Sparkles,
} from "lucide-react";
import { type LeaderboardEntry, type PeerComparisonResult, fetchPeerComparison } from "@/lib/api";

const impactColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-500 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

function redactComparisonScores(text: string): string {
    return String(text || "")
        .replace(/\b\d+(\.\d+)?\s*%/g, "benchmark level")
        .replace(/\b\d+(\.\d+)?\s*\/\s*100\b/g, "benchmark level")
        .replace(/\b(score|gap|rate|rating)\s*(is|of|:)?\s*-?\d+(\.\d+)?\b/gi, "$1 is benchmarked");
}

interface LeaderboardTabProps {
    leaderboard: LeaderboardEntry[];
    currentManagerId: string;
    loading: boolean;
}

// ────────── Comparison Modal ──────────
const ComparisonModal = ({
    data,
    peerRank,
    loading,
    error,
    onClose,
}: {
    data: PeerComparisonResult | null;
    peerRank: number;
    loading: boolean;
    error: string | null;
    onClose: () => void;
}) => {
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
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
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
                                <GitCompareArrows className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-display text-lg font-semibold text-foreground">Peer Comparison</h3>
                                <p className="text-xs text-muted-foreground">
                                    vs Rank #{peerRank} Manager
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/60 transition-colors">
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Analyzing peer differences...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    {data && !loading && (
                        <>
                            {/* Score Summary */}
                            <div className="p-4 rounded-xl bg-card border border-border">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Score</p>
                                        <p className="text-2xl font-display font-bold text-foreground">{data.scoreSummary.yourScore}</p>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-medium text-muted-foreground">POSITION</span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${data.scoreSummary.gap > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"}`}>
                                            {data.scoreSummary.gap > 0 ? "Behind Benchmark" : "On Track"}
                                        </span>
                                    </div>
                                    <div className="flex-1 text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Peer #{peerRank}</p>
                                        <p className="text-sm font-bold text-primary">Higher-ranked peer</p>
                                    </div>
                                </div>
                                {data.scoreSummary.topDifferentiators?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {data.scoreSummary.topDifferentiators.map((d, i) => (
                                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Overall Insight */}
                            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
                                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Sparkles className="h-2.5 w-2.5" /> AI Insight
                                </p>
                                <p className="text-sm text-foreground leading-relaxed italic">{redactComparisonScores(data.overallInsight)}</p>
                            </div>

                            {/* Peer Advantages */}
                            <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Target className="h-3 w-3" /> What They Do Better
                                </p>
                                <div className="space-y-3">
                                    {data.peerAdvantages.map((adv, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.08 }}
                                            className="p-4 rounded-xl bg-card border border-border"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-foreground">{adv.area}</span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${impactColors[adv.impact] || impactColors.medium}`}>
                                                    {adv.impact} impact
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <TrendingUp className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Peer:</span> {redactComparisonScores(adv.peerStrength)}</p>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Your opportunity:</span> {redactComparisonScores(adv.yourGap)}</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Action</p>
                                                    <p className="text-xs font-medium text-foreground">{redactComparisonScores(adv.actionItem)}</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ────────── Main Tab ──────────
const LeaderboardTab = ({ leaderboard, currentManagerId, loading }: LeaderboardTabProps) => {
    const [comparePeerId, setComparePeerId] = useState<string | null>(null);
    const [comparePeerRank, setComparePeerRank] = useState(0);
    const [comparisonData, setComparisonData] = useState<PeerComparisonResult | null>(null);
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [comparisonError, setComparisonError] = useState<string | null>(null);

    const handleCompare = async (peerId: string, peerRank: number) => {
        setComparePeerId(peerId);
        setComparePeerRank(peerRank);
        setComparisonData(null);
        setComparisonError(null);
        setComparisonLoading(true);

        try {
            const data = await fetchPeerComparison(currentManagerId, peerId);
            setComparisonData(data);
        } catch (err: any) {
            setComparisonError(err?.response?.data?.message || err?.message || "Failed to generate comparison");
        } finally {
            setComparisonLoading(false);
        }
    };

    const closeComparison = () => {
        setComparePeerId(null);
        setComparisonData(null);
        setComparisonError(null);
    };

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

    // Find current manager's rank
    const currentEntry = leaderboard.find(e => e.id === currentManagerId);
    const currentRank = currentEntry?.rank ?? Infinity;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-display text-lg font-semibold text-foreground">Manager Leaderboard</h3>
                <p className="text-sm text-muted-foreground">Ranked by effectiveness score with 7-day trend</p>
            </div>

            <div className="space-y-3">
                {(() => {
                    const top5 = leaderboard.slice(0, 5);
                    const currentInTop5 = top5.some(e => e.id === currentManagerId);
                    const currentFloatingEntry = !currentInTop5
                        ? leaderboard.find(e => e.id === currentManagerId)
                        : null;

                    const renderRow = (entry: LeaderboardEntry, i: number) => {
                        const isTop3 = entry.rank <= 3;
                        const medals = ["🥇", "🥈", "🥉"];
                        const isCurrentManager = entry.id === currentManagerId;
                        // Show compare button for: current manager's own card, and managers ranked above current
                        const canCompare = !isCurrentManager && entry.rank < currentRank;

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
                                    {/* Compare button — only for managers ranked above current */}
                                    {canCompare && (
                                        <button
                                            onClick={() => handleCompare(entry.id, entry.rank)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 border border-violet-500/20 transition-colors text-[11px] font-bold"
                                            title="Compare with this manager"
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            <GitCompareArrows className="h-3.5 w-3.5" />
                                            Compare
                                        </button>
                                    )}

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

                                </div>
                            </motion.div>
                        );
                    };

                    return (
                        <>
                            {top5.map((entry, i) => renderRow(entry, i))}
                            {currentFloatingEntry && (
                                <>
                                    {/* Separator */}
                                    <div className="flex items-center gap-3 py-1">
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                        <span className="text-[10px] text-muted-foreground font-medium">Your Position</span>
                                        <div className="flex-1 border-t border-dashed border-border/60" />
                                    </div>
                                    {renderRow(currentFloatingEntry, 5)}
                                </>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Comparison Modal */}
            <AnimatePresence>
                {comparePeerId && (
                    <ComparisonModal
                        data={comparisonData}
                        peerRank={comparePeerRank}
                        loading={comparisonLoading}
                        error={comparisonError}
                        onClose={closeComparison}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default LeaderboardTab;
