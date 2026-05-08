import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    Legend,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
    ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Calendar, Loader2, Trophy, Target, Users, Flame, ZoomIn } from "lucide-react";
import {
    fetchScoreSnapshots,
    fetchPeerTrendBenchmark,
    fetchManagerLeaderboard,
    type ScoreSnapshot,
    type PeerTrendBenchmark,
} from "@/lib/api";
import { buildPeerFallbackBenchmark } from "@/lib/peerTrendBenchmark";

interface ScoreTrendChartProps {
    managerId: string;
    currentScore: number;
    showPeerComparison?: boolean;
}

type TimeRange = "3m" | "6m" | "12m";

const timeRangeLabels: Record<TimeRange, string> = {
    "3m": "3 Months",
    "6m": "6 Months",
    "12m": "1 Year",
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    const score = data.finalScore;
    const category = data.category;

    const categoryColor =
        score >= 85
            ? "text-emerald-400"
            : score >= 70
                ? "text-blue-400"
                : score >= 50
                    ? "text-amber-400"
                    : "text-red-400";

    return (
        <div className="rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl px-4 py-3 min-w-[180px]">
            <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {label}
            </p>
            <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-display font-bold text-foreground">
                    {score}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <span className={`text-xs font-semibold ${categoryColor}`}>
                {category}
            </span>
            <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-3 gap-2">
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Emp</p>
                    <p className="text-xs font-semibold text-foreground">
                        {Math.round((data.empScore ?? 0) * 100)}%
                    </p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Fbk</p>
                    <p className="text-xs font-semibold text-foreground">
                        {Math.round((data.fbScore ?? 0) * 100)}%
                    </p>
                </div>
                <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Met</p>
                    <p className="text-xs font-semibold text-foreground">
                        {Math.round((data.metScore ?? 0) * 100)}%
                    </p>
                </div>
            </div>
        </div>
    );
};

const peerLineStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
    self: { stroke: "hsl(var(--primary))", strokeWidth: 3 },
    top: { stroke: "#f59e0b", strokeWidth: 2.5 },
    above: { stroke: "#22c55e", strokeWidth: 2 },
    below: { stroke: "#0ea5e9", strokeWidth: 2 },
    peer_avg: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2, strokeDasharray: "6 4" },
};

const tierBadgeStyles: Record<string, string> = {
    Champion: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    Elite: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    Contender: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Rising: "bg-secondary text-muted-foreground border-border",
};

const peerAnonLabels: Record<string, string> = {
    self: "You",
    top: "Top Performer",
    above: "Above Avg",
    below: "Bottom Performer",
    peer_avg: "Peer Average",
};

function formatPeerScore(value: number | null | undefined): string {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "0";
    const roundedValue = Math.round(numericValue * 10) / 10;
    return Number.isInteger(roundedValue) ? String(roundedValue) : roundedValue.toFixed(1);
}

function formatSignedPeerScore(value: number | null | undefined): string {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue === 0) return "0";
    return `${numericValue > 0 ? "+" : "-"}${formatPeerScore(Math.abs(numericValue))}`;
}

const PeerTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const rows = payload
        .filter((p: any) => typeof p.value === "number")
        .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

    if (rows.length === 0) return null;

    return (
        <div className="rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl px-4 py-3 min-w-[220px]">
            <p className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {label}
            </p>
            <div className="space-y-1.5">
                {rows.map((row: any) => (
                    <div key={row.dataKey} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: row.stroke }}
                            />
                            <span className="text-xs text-foreground truncate">
                                {peerAnonLabels[row.dataKey] || row.name}
                            </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{formatPeerScore(row.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScoreTrendChart = ({ managerId, currentScore, showPeerComparison = false }: ScoreTrendChartProps) => {
    const [snapshots, setSnapshots] = useState<ScoreSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>("12m");
    const [peerBenchmark, setPeerBenchmark] = useState<PeerTrendBenchmark | null>(null);
    const [peerLoading, setPeerLoading] = useState(false);
    const [peerError, setPeerError] = useState<string | null>(null);

    useEffect(() => {
        if (!managerId) return;
        setLoading(true);
        setError(null);

        const months = parseInt(timeRange, 10);
        fetchScoreSnapshots(managerId, months)
            .then((data) => {
                setSnapshots(data);
            })
            .catch((err) => {
                console.error("Failed to load score trend:", err);
                setError("Unable to load score history");
            })
            .finally(() => setLoading(false));
    }, [managerId, timeRange]);

    useEffect(() => {
        if (!showPeerComparison || !managerId) {
            setPeerBenchmark(null);
            setPeerError(null);
            return;
        }

        const months = parseInt(timeRange, 10);
        setPeerLoading(true);
        setPeerError(null);

        fetchPeerTrendBenchmark(managerId, months)
            .then((data) => {
                setPeerBenchmark(data);
            })
            .catch(async (err) => {
                console.error("Failed to load peer trend benchmark:", err);
                try {
                    const leaderboard = await fetchManagerLeaderboard(managerId);
                    const fallback = buildPeerFallbackBenchmark(leaderboard, managerId, months, currentScore);
                    setPeerBenchmark(fallback);
                    setPeerError(null);
                } catch (fallbackErr) {
                    console.error("Fallback leaderboard fetch failed:", fallbackErr);
                    const selfOnlyFallback = buildPeerFallbackBenchmark([], managerId, months, currentScore);
                    setPeerBenchmark(selfOnlyFallback);
                    setPeerError(null);
                }
            })
            .finally(() => setPeerLoading(false));
    }, [managerId, timeRange, showPeerComparison, currentScore]);

    // Transform data for chart
    const chartData = useMemo(() => {
        return snapshots.map((snap) => ({
            date: new Date(snap.createdAt).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
            }),
            fullDate: new Date(snap.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
            }),
            finalScore: snap.finalScore,
            category: snap.category,
            empScore: snap.breakdown.avgEmployeeScore,
            fbScore: snap.breakdown.avgFeedbackScore,
            metScore: snap.breakdown.avgMetricScore,
        }));
    }, [snapshots]);

    // Trend calculation
    const trend = useMemo(() => {
        if (chartData.length < 2)
            return { direction: "neutral" as const, change: 0, percentage: 0 };

        const first = chartData[0].finalScore;
        const last = chartData[chartData.length - 1].finalScore;
        const change = last - first;
        const percentage = first > 0 ? Math.round((change / first) * 100) : 0;

        return {
            direction: change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("neutral" as const),
            change,
            percentage,
        };
    }, [chartData]);

    // Average score
    const avgScore = useMemo(() => {
        if (chartData.length === 0) return 0;
        return Math.round(
            chartData.reduce((sum, d) => sum + d.finalScore, 0) / chartData.length
        );
    }, [chartData]);

    // Min and max
    const { minScore, maxScore } = useMemo(() => {
        if (chartData.length === 0) return { minScore: 0, maxScore: 100 };
        const scores = chartData.map((d) => d.finalScore);
        return { minScore: Math.min(...scores), maxScore: Math.max(...scores) };
    }, [chartData]);

    // Chart Y domain with padding
    const yDomain = useMemo(() => {
        const pad = 10;
        return [Math.max(0, minScore - pad), Math.min(100, maxScore + pad)];
    }, [minScore, maxScore]);

    const peerSummary = peerBenchmark?.summary ?? null;
    const peerSeries = peerBenchmark?.series ?? [];

    const peerChartData = useMemo(() => {
        if (peerSeries.length === 0) return [];

        return peerSeries[0].points.map((point, index) => {
            const row: Record<string, string | number | null> = {
                label: point.label,
                monthKey: point.monthKey,
            };

            peerSeries.forEach((series) => {
                row[series.key] = series.points[index]?.score ?? null;
            });

            return row;
        });
    }, [peerSeries]);

    // ── Peer Arena zoom state ──
    const [peerZoomRefLeft, setPeerZoomRefLeft] = useState<string | null>(null);
    const [peerZoomRefRight, setPeerZoomRefRight] = useState<string | null>(null);
    const [peerZoomLeft, setPeerZoomLeft] = useState<number | null>(null);
    const [peerZoomRight, setPeerZoomRight] = useState<number | null>(null);
    const isPeerDragging = peerZoomRefLeft !== null;

    // Reset zoom when time range or data changes
    useEffect(() => {
        setPeerZoomLeft(null);
        setPeerZoomRight(null);
        setPeerZoomRefLeft(null);
        setPeerZoomRefRight(null);
    }, [timeRange, peerChartData.length]);

    const peerDisplayData = useMemo(() => {
        if (peerZoomLeft === null || peerZoomRight === null) return peerChartData;
        const left = Math.min(peerZoomLeft, peerZoomRight);
        const right = Math.max(peerZoomLeft, peerZoomRight);
        return peerChartData.slice(left, right + 1);
    }, [peerChartData, peerZoomLeft, peerZoomRight]);

    const peerZoomYDomain = useMemo<[number, number]>(() => {
        if (peerDisplayData.length === 0) return [0, 100];
        const seriesKeys = peerSeries.map((s) => s.key);
        let min = 100;
        let max = 0;
        peerDisplayData.forEach((row) => {
            seriesKeys.forEach((key) => {
                const val = row[key];
                if (typeof val === "number") {
                    if (val < min) min = val;
                    if (val > max) max = val;
                }
            });
        });
        const pad = 8;
        return [Math.max(0, Math.floor(min - pad)), Math.min(100, Math.ceil(max + pad))];
    }, [peerDisplayData, peerSeries]);

    const isZoomed = peerZoomLeft !== null && peerZoomRight !== null;

    const handlePeerMouseDown = useCallback((e: any) => {
        if (e?.activeLabel) setPeerZoomRefLeft(e.activeLabel);
    }, []);

    const handlePeerMouseMove = useCallback((e: any) => {
        if (peerZoomRefLeft && e?.activeLabel) setPeerZoomRefRight(e.activeLabel);
    }, [peerZoomRefLeft]);

    const handlePeerMouseUp = useCallback(() => {
        if (!peerZoomRefLeft || !peerZoomRefRight) {
            setPeerZoomRefLeft(null);
            setPeerZoomRefRight(null);
            return;
        }
        let idxLeft = peerChartData.findIndex((d) => d.label === peerZoomRefLeft);
        let idxRight = peerChartData.findIndex((d) => d.label === peerZoomRefRight);
        if (idxLeft > idxRight) [idxLeft, idxRight] = [idxRight, idxLeft];
        if (idxLeft === idxRight) {
            setPeerZoomRefLeft(null);
            setPeerZoomRefRight(null);
            return;
        }
        setPeerZoomLeft(idxLeft);
        setPeerZoomRight(idxRight);
        setPeerZoomRefLeft(null);
        setPeerZoomRefRight(null);
    }, [peerZoomRefLeft, peerZoomRefRight, peerChartData]);

    const resetPeerZoom = useCallback(() => {
        setPeerZoomLeft(null);
        setPeerZoomRight(null);
    }, []);

    const standingText = useMemo(() => {
        if (!peerSummary) return "";
        if (peerSummary.rank === 1) {
            if (peerSummary.scoreLeadOverBelow > 0) {
                return `${formatPeerScore(peerSummary.scoreLeadOverBelow)} pts ahead of the next peer`;
            }
            return "You are currently leading your peer group";
        }
        if (peerSummary.scoreGapToNext > 0) {
            return `${formatPeerScore(peerSummary.scoreGapToNext)} pts behind the next peer`;
        }
        return `You are ranked #${peerSummary.rank} of ${peerSummary.totalPeers}`;
    }, [peerSummary]);

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6"
            >
                <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-lg font-semibold text-foreground">
                        Score Trend
                    </h3>
                </div>
                <div className="flex items-center justify-center h-[260px]">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            </motion.div>
        );
    }

    const hasMainTrendData = !error && chartData.length > 0;

    const TrendIcon =
        trend.direction === "up"
            ? TrendingUp
            : trend.direction === "down"
                ? TrendingDown
                : Minus;

    const trendColor =
        trend.direction === "up"
            ? "text-emerald-400"
            : trend.direction === "down"
                ? "text-red-400"
                : "text-muted-foreground";

    const trendBg =
        trend.direction === "up"
            ? "bg-emerald-500/10 border-emerald-500/20"
            : trend.direction === "down"
                ? "bg-red-500/10 border-red-500/20"
                : "bg-secondary border-border";

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-xl p-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-display text-lg font-semibold text-foreground leading-none">
                            Score Trend
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Effectiveness score over time
                        </p>
                    </div>
                </div>

                {/* Time range selector */}
                <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1 border border-border">
                    {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeRange === range
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {timeRangeLabels[range]}
                        </button>
                    ))}
                </div>
            </div>

            {hasMainTrendData ? (
                <>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        {/* Trend change */}
                        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${trendBg}`}>
                            <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                            <div>
                                <p className={`text-sm font-bold ${trendColor}`}>
                                    {trend.change > 0 ? "+" : ""}
                                    {trend.change}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Change</p>
                            </div>
                        </div>
                        {/* Current */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10">
                            <div>
                                <p className="text-sm font-bold text-foreground">{currentScore}</p>
                                <p className="text-[10px] text-muted-foreground">Current</p>
                            </div>
                        </div>
                        {/* Average */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/60 border border-border">
                            <div>
                                <p className="text-sm font-bold text-foreground">{avgScore}</p>
                                <p className="text-[10px] text-muted-foreground">Average</p>
                            </div>
                        </div>
                        {/* Range */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/60 border border-border">
                            <div>
                                <p className="text-sm font-bold text-foreground">
                                    {minScore}–{maxScore}
                                </p>
                                <p className="text-[10px] text-muted-foreground">Range</p>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="h-[260px] -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                            offset="0%"
                                            stopColor="hsl(var(--primary))"
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="hsl(var(--primary))"
                                            stopOpacity={0.02}
                                        />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={{ stroke: "hsl(var(--border))" }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    domain={yDomain}
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickCount={5}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{
                                        stroke: "hsl(var(--primary))",
                                        strokeWidth: 1,
                                        strokeDasharray: "4 4",
                                    }}
                                />
                                {/* Average reference line */}
                                <ReferenceLine
                                    y={avgScore}
                                    stroke="hsl(var(--muted-foreground))"
                                    strokeDasharray="6 4"
                                    strokeOpacity={0.4}
                                    label={{
                                        value: `Avg: ${avgScore}`,
                                        position: "right",
                                        fill: "hsl(var(--muted-foreground))",
                                        fontSize: 10,
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="finalScore"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2.5}
                                    fill="url(#scoreFill)"
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        fill: "hsl(var(--primary))",
                                        stroke: "hsl(var(--card))",
                                        strokeWidth: 2,
                                    }}
                                    animationDuration={800}
                                    animationEasing="ease-out"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground border border-border/60 rounded-lg bg-secondary/20 mb-1">
                    <Calendar className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm text-center px-4">
                        {error || "No historical trend snapshots yet for your timeline."}
                    </p>
                </div>
            )}

            {showPeerComparison && (
                <div className="mt-5 pt-5 border-t border-border/50 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h4 className="font-display text-base font-semibold text-foreground">
                                Peer Arena
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                Compare your trend against nearby and top peers
                            </p>
                        </div>
                        {peerSummary && (
                            <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${tierBadgeStyles[peerSummary.tier] || tierBadgeStyles.Rising}`}>
                                {peerSummary.tier} Tier
                            </span>
                        )}
                    </div>

                    {peerLoading ? (
                        <div className="flex items-center justify-center h-[180px]">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : peerError || !peerSummary || peerChartData.length === 0 ? (
                        <div className="rounded-lg border border-border bg-secondary/20 px-4 py-8 text-center">
                            <p className="text-xs text-muted-foreground">
                                {peerError || "Peer trend data is not available yet."}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 min-h-[72px] flex flex-col justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Rank</p>
                                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5 tabular-nums whitespace-nowrap">
                                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                                        #{peerSummary.rank}/{peerSummary.totalPeers}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 min-h-[72px] flex flex-col justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Top Percentile</p>
                                    <p className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{formatPeerScore(peerSummary.topPercentile)}%</p>
                                </div>
                                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 min-h-[72px] flex flex-col justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Gap To Top</p>
                                    <p className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">{formatPeerScore(peerSummary.scoreGapToTop)}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 min-h-[72px] flex flex-col justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Next Peer</p>
                                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5 tabular-nums whitespace-nowrap">
                                        <Users className="h-3.5 w-3.5 text-primary" />
                                        {peerSummary.rank === 1
                                            ? formatSignedPeerScore(peerSummary.scoreLeadOverBelow)
                                            : formatSignedPeerScore(-peerSummary.scoreGapToNext)}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 min-h-[72px] flex flex-col justify-between">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Above Avg Streak</p>
                                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5 tabular-nums whitespace-nowrap">
                                        <Flame className="h-3.5 w-3.5 text-orange-400" />
                                        {peerSummary.abovePeerAverageStreak} mo
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-border bg-card/50 px-3 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            <Target className="h-3.5 w-3.5 text-primary" />
                                            {standingText}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                                            <ZoomIn className="h-3 w-3" />
                                            Click and drag in the plot area to zoom in
                                        </p>
                                    </div>
                                    {isZoomed && (
                                        <button
                                            onClick={resetPeerZoom}
                                            className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                        >
                                            Reset zoom
                                        </button>
                                    )}
                                </div>
                                <div className="h-[220px]" style={{ cursor: isPeerDragging ? 'col-resize' : 'crosshair' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={peerDisplayData}
                                            margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                                            onMouseDown={handlePeerMouseDown}
                                            onMouseMove={handlePeerMouseMove}
                                            onMouseUp={handlePeerMouseUp}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                axisLine={{ stroke: "hsl(var(--border))" }}
                                                tickLine={false}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                domain={peerZoomYDomain}
                                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickCount={5}
                                                allowDataOverflow
                                            />
                                            <Tooltip content={<PeerTooltip />} />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                iconType="line"
                                                wrapperStyle={{ fontSize: "11px" }}
                                                formatter={(_value: string, entry: any) => {
                                                    return peerAnonLabels[entry?.dataKey] || _value;
                                                }}
                                            />
                                            {peerSeries.map((series) => {
                                                const style = peerLineStyles[series.key] || peerLineStyles.peer_avg;
                                                return (
                                                    <Line
                                                        key={series.key}
                                                        type="monotone"
                                                        dataKey={series.key}
                                                        name={peerAnonLabels[series.key] || series.name}
                                                        stroke={style.stroke}
                                                        strokeWidth={style.strokeWidth}
                                                        strokeDasharray={style.strokeDasharray}
                                                        dot={false}
                                                        connectNulls
                                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                                        animationDuration={700}
                                                    />
                                                );
                                            })}
                                            {peerZoomRefLeft && peerZoomRefRight && (
                                                <ReferenceArea
                                                    x1={peerZoomRefLeft}
                                                    x2={peerZoomRefRight}
                                                    strokeOpacity={0.3}
                                                    fill="hsl(var(--primary))"
                                                    fillOpacity={0.15}
                                                />
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground">
                    {hasMainTrendData
                        ? `${chartData.length} monthly data point${chartData.length !== 1 ? "s" : ""} over the last ${timeRangeLabels[timeRange].toLowerCase()}`
                        : `Trend timeline: ${timeRangeLabels[timeRange].toLowerCase()}`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    {hasMainTrendData && trend.direction === "up"
                        ? `📈 Improving (+${trend.percentage}%)`
                        : hasMainTrendData && trend.direction === "down"
                            ? `📉 Declining (${trend.percentage}%)`
                            : "Waiting for trend history"}
                </p>
            </div>
        </motion.div>
    );
};

export default ScoreTrendChart;
