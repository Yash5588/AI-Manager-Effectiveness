import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Calendar, Loader2 } from "lucide-react";
import { fetchScoreSnapshots, type ScoreSnapshot } from "@/lib/api";

interface ScoreTrendChartProps {
    managerId: string;
    currentScore: number;
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

const ScoreTrendChart = ({ managerId, currentScore }: ScoreTrendChartProps) => {
    const [snapshots, setSnapshots] = useState<ScoreSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<TimeRange>("12m");

    useEffect(() => {
        if (!managerId) return;
        setLoading(true);
        setError(null);

        const months = parseInt(timeRange);
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

    if (error || chartData.length === 0) {
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
                <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
                    <Calendar className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">
                        {error || "No historical data yet. Score trends will appear as data accumulates."}
                    </p>
                </div>
            </motion.div>
        );
    }

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

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
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

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground">
                    {chartData.length} monthly data point{chartData.length !== 1 ? "s" : ""} over the last {timeRangeLabels[timeRange].toLowerCase()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    {trend.direction === "up"
                        ? `📈 Improving (+${trend.percentage}%)`
                        : trend.direction === "down"
                            ? `📉 Declining (${trend.percentage}%)`
                            : "➡️ Stable"}
                </p>
            </div>
        </motion.div>
    );
};

export default ScoreTrendChart;
