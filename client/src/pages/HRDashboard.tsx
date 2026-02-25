import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Network,
    Trophy,
    Lightbulb,
    LogOut,
    Loader2,
    Users,
    TrendingUp,
    BarChart3,
    MessageSquare,
    ChevronDown,
    Star,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Building2,
    User,
    Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoreGauge from "@/components/ScoreGauge";
import ScoreTrendChart from "@/components/ScoreTrendChart";
import {
    fetchHROverview,
    fetchHRManagers,
    fetchHierarchy,
    fetchLeaderboard,
    fetchAISuggestions,
    fetchEmployees,
    fetchFeedbacks,
    type HROverview,
    type HRManager,
    type HierarchyData,
    type LeaderboardEntry,
    type AISuggestion,
    type Employee,
    type Feedback,
} from "@/lib/api";

// ─── Helper components ───

function getSentimentLabel(score: number): "Positive" | "Neutral" | "Negative" {
    if (score >= 0.6) return "Positive";
    if (score <= 0.4) return "Negative";
    return "Neutral";
}

function getCategoryColor(category: string) {
    switch (category) {
        case "Excellent": return "text-emerald-400";
        case "Good": return "text-blue-400";
        case "Average": return "text-amber-400";
        default: return "text-red-400";
    }
}

function getCategoryBg(category: string) {
    switch (category) {
        case "Excellent": return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
        case "Good": return "bg-blue-500/10 border-blue-500/20 text-blue-400";
        case "Average": return "bg-amber-500/10 border-amber-500/20 text-amber-400";
        default: return "bg-red-500/10 border-red-500/20 text-red-400";
    }
}

function getRatingColor(rating: number) {
    if (rating >= 4) return "text-emerald-400";
    if (rating >= 3) return "text-amber-400";
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
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [selectedManager, setSelectedManager] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
    const [sugsLoading, setSugsLoading] = useState(false);

    // Deep dive data
    const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
    const [selectedFeedbacks, setSelectedFeedbacks] = useState<Feedback[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        if (user?.id) loadData(user.id);
    }, [user?.id]);

    const loadData = async (hrId: string) => {
        setLoading(true);
        try {
            const [ov, mgrs, hier, lb] = await Promise.all([
                fetchHROverview(hrId),
                fetchHRManagers(hrId),
                fetchHierarchy(hrId),
                fetchLeaderboard(hrId),
            ]);
            setOverview(ov);
            setManagers(mgrs);
            setHierarchy(hier);
            setLeaderboard(lb);

            if (mgrs.length > 0 && !selectedManager) {
                const firstMgrId = mgrs[0]._id;
                setSelectedManager(firstMgrId);
                loadManagerDetails(firstMgrId);
            }
        } catch (e) {
            console.error("Failed to load HR data:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadManagerDetails = async (managerId: string) => {
        setDetailsLoading(true);
        try {
            const [emps, fbs] = await Promise.all([
                fetchEmployees(managerId),
                fetchFeedbacks(managerId),
            ]);
            setSelectedEmployees(emps);
            setSelectedFeedbacks(fbs);
            // Reset suggestions when switching managers
            setSuggestions([]);
        } catch (e) {
            console.error("Failed to load manager details:", e);
        } finally {
            setDetailsLoading(false);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const tabs = [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "details", label: "Manager Details", icon: User },
        { id: "hierarchy", label: "Org Chart", icon: Network },
        { id: "leaderboard", label: "Leaderboard", icon: Trophy },
        { id: "suggestions", label: "AI Suggestions", icon: Lightbulb },
    ];

    const selectedMgr = managers.find(m => m._id === selectedManager);

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
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
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

                    {/* ══════════════ OVERVIEW TAB ══════════════ */}
                    <TabsContent value="overview">
                        <div className="space-y-6">
                            {/* Stat cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                {[
                                    { label: "Total Managers", value: overview?.totalManagers || 0, icon: Building2, color: "text-violet-400" },
                                    { label: "Total Employees", value: overview?.totalEmployees || 0, icon: Users, color: "text-primary" },
                                    { label: "Total Feedbacks", value: overview?.totalFeedbacks || 0, icon: MessageSquare, color: "text-accent" },
                                    { label: "AI Score Avg", value: `${overview?.avgEffectiveness || 0}%`, icon: Sparkles, color: "text-primary shadow-sm shadow-primary/20" },
                                    { label: "Avg Sentiment", value: `${Math.round((overview?.avgSentiment || 0) * 100)}%`, icon: TrendingUp, color: "text-success" },
                                ].map((stat, i) => (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                        className="glass-card rounded-lg p-5"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                        </div>
                                        <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Manager score gauges */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                {managers.slice(0, 3).map((mgr, i) => (
                                    <motion.div
                                        key={mgr._id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 + i * 0.08 }}
                                    >
                                        <ScoreGauge
                                            label={mgr.name}
                                            value={mgr.effectivenessScore}
                                            max={100}
                                            color={mgr.effectivenessScore >= 70 ? "primary" : mgr.effectivenessScore >= 50 ? "accent" : "destructive"}
                                        />
                                    </motion.div>
                                ))}
                            </div>

                            {/* Manager dropdown + trend chart */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-foreground">Score Trend for:</label>
                                    <select
                                        value={selectedManager || ""}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedManager(id);
                                            loadManagerDetails(id);
                                        }}
                                        className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {managers.map(m => (
                                            <option key={m._id} value={m._id}>{m.name} — {m.department}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedManager && (
                                    <ScoreTrendChart
                                        managerId={selectedManager}
                                        currentScore={selectedMgr?.effectivenessScore || 0}
                                    />
                                )}
                            </div>

                            {/* Manager summary cards */}
                            <div className="space-y-3">
                                <h3 className="font-display text-lg font-semibold text-foreground">Manager Summary</h3>
                                {managers.map((mgr, i) => (
                                    <motion.div
                                        key={mgr._id}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.06 }}
                                        className="glass-card rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                                                {mgr.name.split(" ").map(n => n[0]).join("")}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-foreground text-sm truncate">{mgr.name}</p>
                                                <p className="text-xs text-muted-foreground">{mgr.department} · {mgr.counts.employees} employees</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-foreground flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                                    {mgr.effectivenessScore}%
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">AI Score</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-foreground">{Math.round(mgr.sentimentScore * 100)}%</p>
                                                <p className="text-[10px] text-muted-foreground">Sentiment</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-1 rounded-lg border font-bold ${getCategoryBg(mgr.category)}`}>
                                                {mgr.category}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setSelectedManager(mgr._id);
                                                    loadManagerDetails(mgr._id);
                                                    setActiveTab("details");
                                                }}
                                                className="text-xs font-semibold text-primary hover:underline ml-2"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════ DETAILS TAB ══════════════ */}
                    <TabsContent value="details">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                                        {selectedMgr?.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div>
                                        <h3 className="font-display text-lg font-semibold text-foreground">{selectedMgr?.name}</h3>
                                        <p className="text-sm text-muted-foreground">{selectedMgr?.department} · {selectedMgr?.experienceYears}yr Experience</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedManager || ""}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedManager(id);
                                            loadManagerDetails(id);
                                        }}
                                        className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {managers.map(m => (
                                            <option key={m._id} value={m._id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {detailsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Loading manager details...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Team Members */}
                                    <div className="glass-card rounded-xl p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Users className="h-5 w-5 text-primary" />
                                            <h4 className="font-medium text-foreground">Team Members</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {selectedEmployees.map((emp) => (
                                                <div key={emp._id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                                                            {emp.name.split(" ").map(n => n[0]).join("")}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-foreground leading-tight">{emp.name}</p>
                                                            <p className="text-[10px] text-muted-foreground capitalize">{emp.role}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Star className={`h-3 w-3 ${getRatingColor(emp.performanceRating)}`} />
                                                        <span className={`text-xs font-bold ${getRatingColor(emp.performanceRating)}`}>
                                                            {emp.performanceRating}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recent Feedback */}
                                    <div className="glass-card rounded-xl p-6 text-foreground">
                                        <div className="flex items-center gap-2 mb-4">
                                            <MessageSquare className="h-5 w-5 text-accent" />
                                            <h4 className="font-medium text-foreground">Employee Feedback</h4>
                                        </div>
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {selectedFeedbacks.length > 0 ? (
                                                selectedFeedbacks.map((fb) => (
                                                    <div key={fb._id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-[10px] font-bold text-muted-foreground">{fb.employeeName}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${fb.sentimentScore >= 0.6 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : fb.sentimentScore <= 0.4 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                                                                {getSentimentLabel(fb.sentimentScore)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground italic leading-relaxed">"{fb.text}"</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground text-center py-8">No feedback available for this manager.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                    {/* Connector */}
                                    <div className="w-px h-8 bg-border" />
                                    <div className="w-3 h-3 rounded-full border-2 border-border bg-card" />
                                    <div className="w-px h-4 bg-border" />
                                </motion.div>

                                {/* Managers Row */}
                                <div className="flex justify-center">
                                    <div className="relative">
                                        {/* Horizontal connector line */}
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
                                                    {/* Vertical connector down from horizontal line */}
                                                    <div className="w-px h-4 bg-border" />

                                                    {/* Manager Card */}
                                                    <div className={`glass-card rounded-xl p-4 border-2 w-full ${mgr.effectivenessScore >= 70 ? "border-emerald-500/20" :
                                                        mgr.effectivenessScore >= 50 ? "border-amber-500/20" : "border-red-500/20"
                                                        }`}>
                                                        <div className="text-center mb-3">
                                                            <div className={`h-11 w-11 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm mx-auto mb-2`}>
                                                                {mgr.name.split(" ").map(n => n[0]).join("")}
                                                            </div>
                                                            <p className="font-medium text-foreground text-sm">{mgr.name}</p>
                                                            <p className="text-[10px] text-muted-foreground">{mgr.department}</p>
                                                        </div>
                                                        <div className="flex justify-center gap-3 mb-3">
                                                            <div className="text-center">
                                                                <div className="flex items-center gap-1 justify-center">
                                                                    <Sparkles className="h-3 w-3 text-primary" />
                                                                    <p className={`text-lg font-bold ${getCategoryColor(mgr.category)}`}>{mgr.effectivenessScore}%</p>
                                                                </div>
                                                                <p className="text-[9px] text-muted-foreground">AI Score</p>
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

                                                    {/* Connector to employees */}
                                                    <div className="w-px h-4 bg-border" />
                                                    <div className="w-2 h-2 rounded-full border-2 border-border bg-card" />
                                                    <div className="w-px h-3 bg-border" />

                                                    {/* Employees */}
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
                                                                    <Star className={`h-3 w-3 ${getRatingColor(emp.performanceRating)}`} />
                                                                    <span className={`text-xs font-semibold ${getRatingColor(emp.performanceRating)}`}>
                                                                        {emp.performanceRating}
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

                    {/* ══════════════ LEADERBOARD TAB ══════════════ */}
                    <TabsContent value="leaderboard">
                        <div className="space-y-5">
                            <div>
                                <h3 className="font-display text-lg font-semibold text-foreground">Manager Leaderboard</h3>
                                <p className="text-sm text-muted-foreground">Ranked by effectiveness score with 7-day trend</p>
                            </div>

                            <div className="space-y-3">
                                {leaderboard.map((entry, i) => {
                                    const isTop3 = entry.rank <= 3;
                                    const medals = ["🥇", "🥈", "🥉"];

                                    return (
                                        <motion.div
                                            key={entry.id}
                                            initial={{ opacity: 0, x: -16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.08 }}
                                            className={`glass-card rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap ${isTop3 ? "border-2 border-primary/20" : ""
                                                }`}
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                {/* Rank */}
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${isTop3 ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                                                    }`}>
                                                    {isTop3 ? medals[entry.rank - 1] : entry.rank}
                                                </div>
                                                {/* Avatar + info */}
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground text-sm truncate">{entry.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {entry.department} · {entry.experienceYears}yr exp · {entry.counts.employees} employees
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-5">
                                                {/* Effectiveness */}
                                                <div className="text-center">
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                                        <p className={`text-xl font-display font-bold ${getCategoryColor(entry.category)}`}>
                                                            {entry.effectivenessScore}%
                                                        </p>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">AI Score</p>
                                                </div>

                                                {/* Sentiment */}
                                                <div className="text-center">
                                                    <p className="text-xl font-display font-bold text-foreground">
                                                        {Math.round(entry.sentimentScore * 100)}%
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">Sentiment</p>
                                                </div>

                                                {/* 7-day trend */}
                                                <div className="flex items-center gap-1.5 min-w-[80px]">
                                                    {entry.trend > 0 ? (
                                                        <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                                                    ) : entry.trend < 0 ? (
                                                        <ArrowDownRight className="h-4 w-4 text-red-400" />
                                                    ) : (
                                                        <Minus className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span className={`text-sm font-semibold ${entry.trend > 0 ? "text-emerald-400" :
                                                        entry.trend < 0 ? "text-red-400" : "text-muted-foreground"
                                                        }`}>
                                                        {entry.trend > 0 ? "+" : ""}{entry.trend}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">7d</span>
                                                </div>

                                                {/* Category badge */}
                                                <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${getCategoryBg(entry.category)}`}>
                                                    {entry.category}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </TabsContent>

                    {/* ══════════════ AI SUGGESTIONS TAB ══════════════ */}
                    <TabsContent value="suggestions">
                        <div className="space-y-5">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground">
                                        AI Manager Suggestions
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Generate AI-powered improvement suggestions for any manager
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedManager || ""}
                                        onChange={(e) => {
                                            setSelectedManager(e.target.value);
                                            setSuggestions([]);
                                        }}
                                        className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        {managers.map(m => (
                                            <option key={m._id} value={m._id}>{m.name} — {m.department}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => selectedManager && handleGenerateSuggestions(selectedManager)}
                                        disabled={sugsLoading || !selectedManager}
                                        className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                                    >
                                        {sugsLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="h-4 w-4" />
                                        )}
                                        {sugsLoading ? "Generating..." : "Generate Suggestions"}
                                    </button>
                                </div>
                            </div>

                            {/* Selected manager info */}
                            {selectedMgr && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="glass-card rounded-lg p-4 flex items-center gap-4 flex-wrap"
                                >
                                    <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                                        {selectedMgr.name.split(" ").map(n => n[0]).join("")}
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground text-sm">{selectedMgr.name}</p>
                                        <p className="text-xs text-muted-foreground">{selectedMgr.department}</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-4">
                                        <div className="text-center">
                                            <p className={`text-lg font-bold ${getCategoryColor(selectedMgr.category)}`}>{selectedMgr.effectivenessScore}%</p>
                                            <p className="text-[9px] text-muted-foreground">Score</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-lg border font-bold ${getCategoryBg(selectedMgr.category)}`}>
                                            {selectedMgr.category}
                                        </span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Suggestions list */}
                            {sugsLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground">Analyzing manager data...</p>
                                </div>
                            ) : suggestions.length > 0 ? (
                                <div className="grid gap-4">
                                    {suggestions.map((sug, i) => {
                                        const priorityColor = sug.priority === "high"
                                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                                            : sug.priority === "medium"
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                                        const categoryIcon: Record<string, string> = {
                                            communication: "💬",
                                            leadership: "👑",
                                            delegation: "🤝",
                                            growth: "📈",
                                            culture: "🌟",
                                        };

                                        return (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 12 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.08 }}
                                                className="glass-card rounded-xl p-5"
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{categoryIcon[sug.category] || "💡"}</span>
                                                        <h4 className="font-medium text-foreground text-sm">{sug.title}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${priorityColor}`}>
                                                            {sug.priority}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground font-medium capitalize">
                                                            {sug.category}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{sug.description}</p>
                                                <div className="flex items-center gap-2">
                                                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                                                    <span className="text-xs text-muted-foreground">Predicted score:</span>
                                                    <span className="text-sm font-bold text-emerald-400">{sug.predictedScore}%</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        (+{sug.predictedScore - (selectedMgr?.effectivenessScore || 0)})
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <Lightbulb className="h-8 w-8 text-primary" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Select a manager and click "Generate Suggestions" to get AI-powered recommendations.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default HRDashboard;
