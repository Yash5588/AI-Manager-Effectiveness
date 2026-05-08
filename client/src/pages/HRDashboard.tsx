import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Network,
    LogOut,
    Loader2,
    Users,

    Building2,
    MoreHorizontal,
    Eye,
    Lightbulb,
    UserMinus,
    Mail,
    Bot,
    CheckCircle,
    Send,
    BarChart3,
    Filter,
    TrendingUp,
    Zap,
    Download,
    FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    fetchHROverview,
    fetchHRManagers,
    fetchHierarchy,
    fetchAISuggestions,
    fetchAttritionPredictions,
    sendReports,
    sendManagerReport,
    downloadReport,
    type HROverview,
    type HRManager,
    type HierarchyData,
    type AISuggestion,
    type AttritionPrediction,
} from "@/lib/api";
import ManagerDetailModal from "@/components/modals/ManagerDetailModal";
import SuggestionsModal from "@/components/modals/SuggestionsModal";
import AttritionModal from "@/components/modals/AttritionModal";

type InsightMetric = "effectivenessScore" | "sentimentScore";

// ─── Helpers ───

function getCategoryColor(category: string) {
    switch (category) {
        case "Excellent": return "text-emerald-400";
        case "Good": return "text-blue-400";
        case "Average": return "text-amber-400";
        default: return "text-red-400";
    }
}

const getCategoryBg = (cat: string) => {
    switch (cat) {
        case "Excellent": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        case "Good": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        case "Average": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        default: return "bg-red-500/10 text-red-400 border-red-500/20";
    }
};

function getEESColor(score: number) {
    if (score >= 75) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
}

// ─── Main Dashboard ───

const HRDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<HROverview | null>(null);
    const [managers, setManagers] = useState<HRManager[]>([]);
    const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);

    // Modal state
    const [detailManager, setDetailManager] = useState<HRManager | null>(null);
    const [suggestionsManager, setSuggestionsManager] = useState<HRManager | null>(null);
    const [attritionManager, setAttritionManager] = useState<HRManager | null>(null);

    // AI state
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [sugsLoading, setSugsLoading] = useState(false);
    const [attritionPredictions, setAttritionPredictions] = useState<AttritionPrediction[]>([]);
    const [attritionLoading, setAttritionLoading] = useState(false);

    // Reports
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportsSuccess, setReportsSuccess] = useState<string | null>(null);

    // Insights
    const [insightGroupBy, setInsightGroupBy] = useState<"department" | "category" | "experience">("department");
    const [insightMetric, setInsightMetric] = useState<InsightMetric>("effectivenessScore");

    useEffect(() => {
        if (user?.id) loadData(user.id);
    }, [user?.id]);

    const loadData = async (hrId: string) => {
        setLoading(true);
        try {
            const [ov, mgrs, hier] = await Promise.all([
                fetchHROverview(hrId),
                fetchHRManagers(hrId),
                fetchHierarchy(hrId),
            ]);
            setOverview(ov);
            setManagers(mgrs);
            setHierarchy(hier);
        } catch (e) {
            console.error("Failed to load HR data:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSuggestions = async (managerId: string) => {
        setSugsLoading(true);
        try {
            const sugs = await fetchAISuggestions(managerId);
            setSuggestions(sugs);
        } catch (e) {
            console.error("Failed to generate suggestions:", e);
        } finally {
            setSugsLoading(false);
        }
    };

    const handleGenerateAttrition = async (managerId: string) => {
        setAttritionLoading(true);
        try {
            const predictions = await fetchAttritionPredictions(managerId);
            setAttritionPredictions(predictions);
        } catch (e) {
            console.error("Failed to generate attrition risk:", e);
        } finally {
            setAttritionLoading(false);
        }
    };

    const handleSendAllReports = async () => {
        if (!user?.id) return;
        setReportsLoading(true);
        setReportsSuccess(null);
        try {
            const res = await sendReports(user.id);
            setReportsSuccess(res.message);
            setTimeout(() => setReportsSuccess(null), 5000);
        } catch (e) {
            console.error("Failed to send all reports:", e);
        } finally {
            setReportsLoading(false);
        }
    };

    const handleDownloadReport = async () => {
        if (!user?.id) return;
        setReportsLoading(true);
        setReportsSuccess(null);
        try {
            await downloadReport(user.id);
            setReportsSuccess("Report downloaded successfully");
            setTimeout(() => setReportsSuccess(null), 5000);
        } catch (e) {
            console.error("Failed to download report:", e);
        } finally {
            setReportsLoading(false);
        }
    };

    const handleSendSingleReport = async (managerId: string) => {
        if (!user?.id) return;
        setReportsLoading(true);
        setReportsSuccess(null);
        try {
            const res = await sendManagerReport(user.id, managerId);
            setReportsSuccess(res.message);
            setTimeout(() => setReportsSuccess(null), 5000);
        } catch (e) {
            console.error("Failed to send manager report:", e);
        } finally {
            setReportsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Sort managers by score for table rank
    const rankedManagers = [...managers].sort(
        (a, b) => b.effectivenessScore - a.effectivenessScore
    );

    const tabs = [
        { id: "managers", label: "Managers", icon: LayoutDashboard },
        { id: "insights", label: "Insights", icon: BarChart3 },
        { id: "hierarchy", label: "Org Chart", icon: Network },
    ];

    // ─── Insights computation ───
    const metricLabels: Record<InsightMetric, string> = {
        effectivenessScore: "Effectiveness Score",
        sentimentScore: "Sentiment Score",
    };

    const getMetricValue = (mgr: HRManager, metric: InsightMetric): number => {
        if (metric === "effectivenessScore") return mgr.effectivenessScore;
        if (metric === "sentimentScore") return Math.round(mgr.sentimentScore * 100);
        return 0;
    };

    const getGroupKey = (mgr: HRManager): string => {
        if (insightGroupBy === "department") return mgr.department;
        if (insightGroupBy === "category") return mgr.category;
        if (insightGroupBy === "experience") {
            if (mgr.experienceYears < 3) return "0-2 yrs";
            if (mgr.experienceYears < 6) return "3-5 yrs";
            if (mgr.experienceYears < 10) return "6-9 yrs";
            return "10+ yrs";
        }
        return "Other";
    };

    const insightGroups = managers.reduce<Record<string, { total: number; count: number; managers: string[] }>>((acc, mgr) => {
        const key = getGroupKey(mgr);
        if (!acc[key]) acc[key] = { total: 0, count: 0, managers: [] };
        acc[key].total += getMetricValue(mgr, insightMetric);
        acc[key].count += 1;
        acc[key].managers.push(mgr.name);
        return acc;
    }, {});

    const insightData = Object.entries(insightGroups)
        .map(([label, data]) => ({
            label,
            avg: Math.round(data.total / data.count),
            count: data.count,
            managers: data.managers,
        }))
        .sort((a, b) => b.avg - a.avg);

    const insightMax = Math.max(...insightData.map(d => d.avg), 1);

    const getInsightBarColor = (v: number) => {
        if (v >= 75) return "bg-emerald-500";
        if (v >= 50) return "bg-blue-500";
        if (v >= 30) return "bg-amber-500";
        return "bg-red-500";
    };

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
                                style={{ mixBlendMode: 'multiply' }}
                            />
                        </div>
                        <div>
                            <h1 className="font-display text-lg font-bold text-foreground leading-none">
                                HR Dashboard
                            </h1>
                            <p className="text-xs text-muted-foreground">Organization-wide Analytics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {user && (
                            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-[10px]">
                                    {user.name.split(" ").map(n => n[0]).join("")}
                                </div>
                                <div className="text-left hidden sm:block">
                                    <span className="block text-sm font-medium leading-none">{user.name}</span>
                                    <span className="block text-[10px] text-muted-foreground">{user.designation || "HR"}</span>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => { logout(); navigate("/login"); }}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-all text-sm"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-6 max-w-7xl">
                <Tabs defaultValue="managers" className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <TabsList className="bg-card border border-border p-1 h-auto">
                            {tabs.map((tab) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    className="flex items-center gap-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
                                >
                                    <tab.icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        <div className="flex items-center gap-3">
                            {/* Quick stats badges */}
                            <div className="hidden md:flex items-center gap-2">
                                <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground">
                                    <Users className="h-3 w-3 inline mr-1" />
                                    {overview?.totalManagers || 0} Managers
                                </span>
                                <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary/50 text-muted-foreground">
                                    {overview?.totalEmployees || 0} Employees
                                </span>
                                <span className="text-xs px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary font-semibold">
                                    <BarChart3 className="h-3 w-3 inline mr-1" />
                                    Avg {overview?.avgEffectiveness || 0}%
                                </span>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        disabled={reportsLoading}
                                        size="sm"
                                        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 gap-1.5"
                                    >
                                        {reportsLoading ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <FileText className="h-3.5 w-3.5" />
                                        )}
                                        <span className="hidden sm:inline">
                                            {reportsLoading ? "Processing..." : "Reports"}
                                        </span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem
                                        onClick={handleDownloadReport}
                                        disabled={reportsLoading}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download Report
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={handleSendAllReports}
                                        disabled={reportsLoading}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                        Send to all Managers
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Success toast */}
                    {reportsSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2"
                        >
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">{reportsSuccess}</span>
                        </motion.div>
                    )}

                    {/* ══════════════ MANAGERS TABLE TAB ══════════════ */}
                    <TabsContent value="managers">
                        <div className="glass-card rounded-xl border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border bg-secondary/30">
                                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">#</th>
                                            <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Manager</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Score</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Sentiment</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Category</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Team</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Feedbacks</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">HRBP Agent</th>
                                            <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankedManagers.map((mgr, i) => {
                                            const medals = ["🥇", "🥈", "🥉"];
                                            const isTop3 = i < 3;

                                            return (
                                                <motion.tr
                                                    key={mgr._id}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.04 }}
                                                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors group"
                                                >
                                                    {/* Rank */}
                                                    <td className="px-4 py-3">
                                                        <span className={`text-sm font-bold ${isTop3 ? "text-primary" : "text-muted-foreground"}`}>
                                                            {isTop3 ? medals[i] : i + 1}
                                                        </span>
                                                    </td>

                                                    {/* Manager info */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                                                                {mgr.name.split(" ").map(n => n[0]).join("")}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-foreground truncate">{mgr.name}</p>
                                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                    <Building2 className="h-2.5 w-2.5" />
                                                                    {mgr.department} · {mgr.experienceYears}yr
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Score */}
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <BarChart3 className="h-3 w-3 text-primary" />
                                                            <span className={`text-sm font-bold ${getCategoryColor(mgr.category)}`}>
                                                                {mgr.effectivenessScore}%
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Sentiment */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-sm font-semibold text-foreground">
                                                            {Math.round(mgr.sentimentScore * 100)}%
                                                        </span>
                                                    </td>

                                                    {/* Category */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-[10px] px-2 py-1 rounded-lg border font-bold ${getCategoryBg(mgr.category)}`}>
                                                            {mgr.category}
                                                        </span>
                                                    </td>

                                                    {/* Employees */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-sm text-foreground font-medium">
                                                            {mgr.counts.employees}
                                                        </span>
                                                    </td>

                                                    {/* Feedbacks */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-sm text-foreground font-medium">
                                                            {mgr.counts.feedbacks}
                                                        </span>
                                                    </td>

                                                    {/* HRBP Agent (placeholder) */}
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            disabled
                                                            title="HRBP Agent — Coming Soon"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border text-muted-foreground text-[10px] font-medium cursor-not-allowed opacity-60"
                                                        >
                                                            <Bot className="h-3.5 w-3.5" />
                                                            HRBP
                                                        </button>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3 text-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-secondary border border-transparent hover:border-border transition-all">
                                                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem
                                                                    onClick={() => setDetailManager(mgr)}
                                                                    className="flex items-center justify-between gap-2 cursor-pointer rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white focus:bg-purple-500 focus:text-white hover:text-white text-[11px] font-bold px-3 py-2 my-1"
                                                                >
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                        View Details
                                                                    </span>
                                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setSuggestions([]);
                                                                        setSuggestionsManager(mgr);
                                                                    }}
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <Lightbulb className="h-3.5 w-3.5" />
                                                                    AI Suggestions
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        setAttritionPredictions([]);
                                                                        setAttritionManager(mgr);
                                                                    }}
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <UserMinus className="h-3.5 w-3.5" />
                                                                    Attrition Risk
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleSendSingleReport(mgr._id)}
                                                                    disabled={reportsLoading}
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <Mail className="h-3.5 w-3.5" />
                                                                    Send Report
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════ INSIGHTS TAB ══════════════ */}
                    <TabsContent value="insights">
                        <div className="space-y-6">
                            {/* Header & Controls */}
                            <div className="flex items-start justify-between flex-wrap gap-4">
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-primary" />
                                        Comparative Insights
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Compare measurable outcomes across {insightGroupBy === "department" ? "departments" : insightGroupBy === "category" ? "performance categories" : "experience levels"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Group by selector */}
                                    <div className="flex items-center gap-1.5">
                                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Group By</span>
                                    </div>
                                    <div className="flex bg-secondary/50 rounded-lg border border-border p-0.5">
                                        {(["department", "category", "experience"] as const).map((g) => (
                                            <button
                                                key={g}
                                                onClick={() => setInsightGroupBy(g)}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${insightGroupBy === g
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                            >
                                                {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Metric selector pills */}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(metricLabels).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setInsightMetric(key as InsightMetric)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${insightMetric === key
                                            ? "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border"
                                            }`}
                                    >
                                        <BarChart3 className="h-3 w-3" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Chart */}
                            <div className="glass-card rounded-xl border border-border p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-sm font-semibold text-foreground">
                                        {metricLabels[insightMetric]} by {insightGroupBy === "department" ? "Department" : insightGroupBy === "category" ? "Category" : "Experience"}
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground">
                                        {insightData.length} groups · {managers.length} managers
                                    </span>
                                </div>

                                {insightData.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <p className="text-sm text-muted-foreground">No data available</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {insightData.map((group, gi) => (
                                            <motion.div
                                                key={group.label}
                                                initial={{ opacity: 0, x: -12 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: gi * 0.06 }}
                                                className="group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    {/* Label */}
                                                    <div className="w-28 shrink-0">
                                                        <p className="text-sm font-medium text-foreground truncate" title={group.label}>
                                                            {group.label}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {group.count} manager{group.count > 1 ? "s" : ""}
                                                        </p>
                                                    </div>

                                                    {/* Bar */}
                                                    <div className="flex-1 relative">
                                                        <div className="h-8 rounded-lg bg-secondary/40 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(group.avg / insightMax) * 100}%` }}
                                                                transition={{ duration: 0.7, delay: gi * 0.06 }}
                                                                className={`h-full rounded-lg ${getInsightBarColor(group.avg)} flex items-center justify-end pr-3`}
                                                            >
                                                                {(group.avg / insightMax) * 100 > 25 && (
                                                                    <span className="text-xs font-bold text-white">
                                                                        {group.avg}%
                                                                    </span>
                                                                )}
                                                            </motion.div>
                                                        </div>
                                                        {(group.avg / insightMax) * 100 <= 25 && (
                                                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground pr-2">
                                                                {group.avg}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Manager names tooltip on hover */}
                                                <div className="mt-1 overflow-hidden max-h-0 group-hover:max-h-12 transition-all duration-300">
                                                    <p className="text-[10px] text-muted-foreground pl-32 truncate">
                                                        {group.managers.join(", ")}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* All metrics comparison grid */}
                            <div className="glass-card rounded-xl border border-border p-6">
                                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    All Metrics Overview
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">
                                                    {insightGroupBy === "department" ? "Department" : insightGroupBy === "category" ? "Category" : "Experience"}
                                                </th>
                                                <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">#</th>
                                                {Object.entries(metricLabels).map(([key, label]) => (
                                                    <th key={key} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {insightData.map((group, gi) => {
                                                const grpManagers = managers.filter(m => getGroupKey(m) === group.label);
                                                return (
                                                    <motion.tr
                                                        key={group.label}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: gi * 0.04 }}
                                                        className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                                                    >
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-sm font-medium text-foreground">{group.label}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span className="text-xs text-muted-foreground">{group.count}</span>
                                                        </td>
                                                        {(Object.keys(metricLabels) as InsightMetric[]).map(metric => {
                                                            const avg = Math.round(
                                                                grpManagers.reduce((sum, m) => sum + getMetricValue(m, metric), 0) / grpManagers.length
                                                            );
                                                            return (
                                                                <td key={metric} className="px-3 py-2.5 text-center">
                                                                    <span className={`text-sm font-bold ${avg >= 70 ? "text-emerald-500" : avg >= 50 ? "text-blue-500" : avg >= 30 ? "text-amber-500" : "text-red-500"}`}>
                                                                        {avg}%
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </motion.tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════ ORG CHART TAB ══════════════ */}
                    <TabsContent value="hierarchy">
                        {hierarchy ? (
                            <div className="space-y-6">
                                {/* HR Node */}
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center"
                                >
                                    <div className="glass-card rounded-xl p-5 border-2 border-violet-500/30 bg-violet-500/5 text-center w-64">
                                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
                                            {hierarchy.hr.name.split(" ").map(n => n[0]).join("")}
                                        </div>
                                        <p className="font-display font-bold text-foreground">{hierarchy.hr.name}</p>
                                        <p className="text-xs text-muted-foreground">{hierarchy.hr.designation}</p>
                                        <p className="text-[10px] text-violet-400 mt-1">{hierarchy.hr.email}</p>
                                    </div>
                                    <div className="w-px h-8 bg-border" />
                                    <div className="w-3 h-3 rounded-full border-2 border-border bg-card" />
                                    <div className="w-px h-4 bg-border" />
                                </motion.div>

                                {/* Managers Row */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        {hierarchy.managers.length > 1 && (
                                            <div
                                                className="absolute top-0 h-px bg-border"
                                                style={{
                                                    left: `${100 / (hierarchy.managers.length * 2)}%`,
                                                    right: `${100 / (hierarchy.managers.length * 2)}%`,
                                                }}
                                            />
                                        )}
                                        <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${hierarchy.managers.length}, minmax(220px, 1fr))` }}>
                                            {hierarchy.managers.map((mgr, i) => (
                                                <motion.div
                                                    key={mgr.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.15 + i * 0.1 }}
                                                    className="flex flex-col items-center"
                                                >
                                                    <div className="w-px h-4 bg-border" />
                                                    <div className={`glass-card rounded-xl p-4 border-2 w-full ${mgr.effectivenessScore >= 70 ? "border-emerald-500/20" :
                                                        mgr.effectivenessScore >= 50 ? "border-amber-500/20" : "border-red-500/20"
                                                        }`}>
                                                        <div className="text-center mb-3">
                                                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm mx-auto mb-2">
                                                                {mgr.name.split(" ").map(n => n[0]).join("")}
                                                            </div>
                                                            <p className="font-medium text-foreground text-sm">{mgr.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{mgr.department}</p>
                                                        </div>
                                                        <div className="flex justify-center gap-3 mb-3">
                                                            <div className="text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <BarChart3 className="h-3 w-3 text-primary" />
                                                                    <p className={`text-lg font-bold ${getCategoryColor(mgr.category)}`}>{mgr.effectivenessScore}%</p>
                                                                </div>
                                                                <p className="text-[9px] text-muted-foreground">Score</p>
                                                            </div>
                                                            <div className="w-px bg-border" />
                                                            <div className="text-center">
                                                                <p className="text-lg font-bold text-foreground">{Math.round(mgr.sentimentScore * 100)}%</p>
                                                                <p className="text-[9px] text-muted-foreground">Sentiment</p>
                                                            </div>
                                                        </div>
                                                        <span className={`block text-center text-[10px] px-2 py-1 rounded-lg border font-bold ${getCategoryBg(mgr.category)}`}>
                                                            {mgr.category}
                                                        </span>
                                                    </div>

                                                    <div className="w-px h-4 bg-border" />
                                                    <div className="w-2 h-2 rounded-full border-2 border-border bg-card" />
                                                    <div className="w-px h-3 bg-border" />

                                                    <div className="space-y-2 w-full">
                                                        {mgr.employees.map((emp, j) => (
                                                            <motion.div
                                                                key={emp.id}
                                                                initial={{ opacity: 0, x: -8 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.3 + i * 0.1 + j * 0.05 }}
                                                                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/40 border border-border/50"
                                                            >
                                                                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-[10px] font-bold shrink-0">
                                                                    {emp.name.split(" ").map(n => n[0]).join("")}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-xs font-medium text-foreground truncate">{emp.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground truncate">{emp.role}</p>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Zap className={`h-3 w-3 ${getEESColor(emp.ees)}`} />
                                                                    <span className={`text-xs font-semibold ${getEESColor(emp.ees)}`}>
                                                                        {emp.ees}%
                                                                    </span>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        )}
                    </TabsContent>

                </Tabs>
            </main>

            {/* ═══ Modals ═══ */}
            <ManagerDetailModal
                manager={detailManager}
                open={!!detailManager}
                onClose={() => setDetailManager(null)}
            />
            <SuggestionsModal
                manager={suggestionsManager}
                open={!!suggestionsManager}
                onClose={() => setSuggestionsManager(null)}
                suggestions={suggestions}
                loading={sugsLoading}
                onGenerate={handleGenerateSuggestions}
            />
            <AttritionModal
                manager={attritionManager}
                open={!!attritionManager}
                onClose={() => setAttritionManager(null)}
                predictions={attritionPredictions}
                loading={attritionLoading}
                onGenerate={handleGenerateAttrition}
            />
        </div>
    );
};

export default HRDashboard;