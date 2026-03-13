import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Network,
    LogOut,
    Loader2,
    Users,
    Star,
    Sparkles,
    Building2,
    MoreHorizontal,
    Eye,
    Lightbulb,
    UserMinus,
    Mail,
    Bot,
    CheckCircle,
    Send,
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
    type HROverview,
    type HRManager,
    type HierarchyData,
    type AISuggestion,
    type AttritionPrediction,
} from "@/lib/api";
import ManagerDetailModal from "@/components/modals/ManagerDetailModal";
import SuggestionsModal from "@/components/modals/SuggestionsModal";
import AttritionModal from "@/components/modals/AttritionModal";

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
        { id: "hierarchy", label: "Org Chart", icon: Network },
    ];

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
                                    <Sparkles className="h-3 w-3 inline mr-1" />
                                    Avg {overview?.avgEffectiveness || 0}%
                                </span>
                            </div>
                            <Button
                                onClick={handleSendAllReports}
                                disabled={reportsLoading}
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 gap-1.5"
                            >
                                {reportsLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Send className="h-3.5 w-3.5" />
                                )}
                                <span className="hidden sm:inline">
                                    {reportsLoading ? "Sending..." : "Send All Reports"}
                                </span>
                            </Button>
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
                                                            <Sparkles className="h-3 w-3 text-primary" />
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
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                    View Details
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
                                                                    <Sparkles className="h-3 w-3 text-primary" />
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