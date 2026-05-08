import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, UserCheck, Loader2, ChevronDown, LogOut, Trophy, FileText, Download, Send, CheckCircle, Network } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "@/components/tabs/OverviewTab";


import EmployeeSuggestionsTab from "@/components/tabs/EmployeeSuggestionsTab";
import LeaderboardTab from "@/components/tabs/LeaderboardTab";
import OrgChartTab from "@/components/tabs/OrgChartTab";

import {
  fetchManager,
  fetchEmployees,
  fetchFeedbacks,
  fetchMetrics,
  fetchAISuggestions,
  fetchEmployeeSuggestions,
  updateEmployeeActionable,
  fetchAttritionPredictions,
  fetchEmployeeCoaching,
  fetchManagerLeaderboard,
  fetchSentimentTrend,
  downloadManagerReport,
  sendManagerSelfReport,
  type Manager,
  type LeaderboardEntry,
  type Employee,
  type Feedback,
  type Metric,
  type AISuggestion,
  type EmployeeSuggestion,
  type AttritionPrediction,
  type EmployeeCoachingProfile,
  type TeamCoachingMetrics,
  type SentimentTrend,
  type ActionableProgress,
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Manager | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [sugsLoading, setSugsLoading] = useState(false);
  const [sugsError, setSugsError] = useState<string | null>(null);
  const [employeeSuggestions, setEmployeeSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [empSugLoading, setEmpSugLoading] = useState(false);
  const [attritionPredictions, setAttritionPredictions] = useState<AttritionPrediction[]>([]);
  const [attritionLoading, setAttritionLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [coachingProfiles, setCoachingProfiles] = useState<EmployeeCoachingProfile[]>([]);
  const [teamMetrics, setTeamMetrics] = useState<TeamCoachingMetrics | null>(null);
  const [actionableProgress, setActionableProgress] = useState<ActionableProgress | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentTrend | null>(null);

  // Reports
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // 1. Load data for the logged in manager
  useEffect(() => {
    if (user?.id) {
      handleManagerChange(user.id);
    }
  }, [user?.id]);

  const handleManagerChange = async (managerId: string) => {
    setLoading(true);
    setEmployeeSuggestions([]);
    setSuggestions([]);
    setAttritionPredictions([]);
    setCoachingProfiles([]);
    setTeamMetrics(null);
    setActionableProgress(null);
    setSentimentTrend(null);
    try {
      const mgr = await fetchManager(managerId);
      setManager(mgr);

      // Load employees & feedbacks (required data)
      const [emps, fbs, mtr] = await Promise.all([
        fetchEmployees(mgr.id),
        fetchFeedbacks(mgr.id),
        fetchMetrics(mgr.id),
      ]);
      setEmployees(emps);
      setFeedbacks(fbs);
      setMetrics(mtr);

      // Load sentiment trend (non-blocking)
      fetchSentimentTrend(mgr.id)
        .then(setSentimentTrend)
        .catch((err) => { console.warn("Sentiment trend failed:", err); });

      // Load AI suggestions + coaching data in parallel (non-blocking)
      const suggestionsPromise = (async () => {
        try {
          setSugsLoading(true);
          setSugsError(null);
          const sugs = await fetchAISuggestions(mgr.id);
          setSuggestions(sugs);
        } catch (sugErr: any) {
          console.warn("AI suggestions failed (API key issue?):", sugErr);
          setSuggestions([]);
          setSugsError(sugErr?.response?.data?.message || sugErr?.message || "AI suggestions failed");
        } finally {
          setSugsLoading(false);
        }
      })();

      const coachingPromise = (async () => {
        try {
          setCoachingLoading(true);
          const coaching = await fetchEmployeeCoaching(mgr.id);
          setCoachingProfiles(coaching.employees);
          setTeamMetrics(coaching.teamMetrics);
          setActionableProgress(coaching.progress || null);
        } catch (coachErr) {
          console.warn("Employee coaching data failed:", coachErr);
        } finally {
          setCoachingLoading(false);
        }
      })();

      const employeeSuggestionsPromise = (async () => {
        try {
          setEmpSugLoading(true);
          const result = await fetchEmployeeSuggestions(mgr.id);
          setEmployeeSuggestions(result.employeeSuggestions);
          setActionableProgress(result.progress || null);
        } catch (empSugErr) {
          console.warn("Employee suggestions failed:", empSugErr);
        } finally {
          setEmpSugLoading(false);
        }
      })();

      const leaderboardPromise = (async () => {
        try {
          setLeaderboardLoading(true);
          const lb = await fetchManagerLeaderboard(managerId);
          setLeaderboard(lb);
        } catch (lbErr) {
          console.warn("Leaderboard data failed:", lbErr);
          setLeaderboard([]);
        } finally {
          setLeaderboardLoading(false);
        }
      })();

      const attritionPromise = (async () => {
        try {
          setAttritionLoading(true);
          const result = await fetchAttritionPredictions(mgr.id);
          setAttritionPredictions(result);
        } catch (attrErr) {
          console.warn("Attrition predictions failed:", attrErr);
        } finally {
          setAttritionLoading(false);
        }
      })();

      await Promise.all([suggestionsPromise, coachingPromise, employeeSuggestionsPromise, leaderboardPromise, attritionPromise]);
    } catch (e) {
      console.error("Failed to load manager details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!manager) return;
    setSugsLoading(true);
    setSugsError(null);
    try {
      const sugs = await fetchAISuggestions(manager.id);
      setSuggestions(sugs);
    } catch (e: any) {
      console.error("Failed to generate suggestions:", e);
      setSugsError(e?.response?.data?.message || e?.message || "AI suggestions failed");
    } finally {
      setSugsLoading(false);
    }
  };

  const handleGenerateEmployeeSuggestions = async () => {
    if (!manager) return;
    setEmpSugLoading(true);
    try {
      const result = await fetchEmployeeSuggestions(manager.id);
      setEmployeeSuggestions(result.employeeSuggestions);
      setActionableProgress(result.progress || null);
    } catch (e) {
      console.error("Failed to generate employee suggestions:", e);
    } finally {
      setEmpSugLoading(false);
    }
  };

  const handleGenerateAttrition = async () => {
    if (!manager) return;
    setAttritionLoading(true);
    try {
      const result = await fetchAttritionPredictions(manager.id);
      setAttritionPredictions(result);
    } catch (e) {
      console.error("Failed to generate attrition risk:", e);
    } finally {
      setAttritionLoading(false);
    }
  };

  const handleToggleActionable = async (
    actionableId: string,
    completed: boolean,
    completion?: Parameters<typeof updateEmployeeActionable>[3]
  ) => {
    if (!manager) return;

    console.log(`🔘 Toggling actionable: ${actionableId} -> ${completed}`);

    try {
      const result = await updateEmployeeActionable(manager.id, actionableId, completed, completion);
      console.log("✅ Actionable update success:", result);

      if (result.manager) {
        setManager((prev) => {
          if (!prev) return result.manager!;
          const newSentiment = (result.manager!.sentimentScore != null && result.manager!.sentimentScore > 0)
            ? result.manager!.sentimentScore
            : prev.sentimentScore;
          return {
            ...prev,
            ...result.manager,
            effectivenessScore: result.currentScore,
            sentimentScore: newSentiment,
            sentimentLabel: newSentiment >= 0.6 ? "Positive" : newSentiment <= 0.4 ? "Negative" : "Neutral",
          };
        });
      } else {
        setManager((prev) => prev ? {
          ...prev,
          effectivenessScore: result.currentScore,
        } : prev);
      }

      if (result.coachingProfiles) {
        setCoachingProfiles(result.coachingProfiles);
      }
      if (result.teamMetrics) {
        setTeamMetrics(result.teamMetrics);
      }
      if (result.attritionPredictions) {
        setAttritionPredictions(result.attritionPredictions);
      }

      setEmployeeSuggestions(result.employeeSuggestions);
      setActionableProgress(result.progress || null);

      fetchManagerLeaderboard(manager.id)
        .then(setLeaderboard)
        .catch((err) => console.warn("Leaderboard refresh failed:", err));
    } catch (err: any) {
      console.error("❌ Actionable update failed:", err);
    }
  };

  const handleDownloadReport = async () => {
    if (!manager) return;
    setReportLoading(true);
    setReportSuccess(null);
    try {
      await downloadManagerReport(manager.id);
      setReportSuccess("Report downloaded successfully");
      setTimeout(() => setReportSuccess(null), 5000);
    } catch (e) {
      console.error("Failed to download report:", e);
    } finally {
      setReportLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!manager) return;
    setReportLoading(true);
    setReportSuccess(null);
    try {
      const res = await sendManagerSelfReport(manager.id);
      setReportSuccess(res.message);
      setTimeout(() => setReportSuccess(null), 5000);
    } catch (e) {
      console.error("Failed to send report:", e);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading && !manager) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "employee-suggestions", label: "Employee Coaching", icon: UserCheck },
    { id: "org-chart", label: "Org Chart", icon: Network },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
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
                Manager Effectiveness
              </h1>
              <p className="text-xs text-muted-foreground">AI-Powered Analytics Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {manager && (
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
                  {manager.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="block text-sm font-medium leading-none">{manager.name}</span>
                  <span className="block text-[10px] text-muted-foreground">Manager</span>
                </div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={reportLoading}
                  size="sm"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 gap-1.5"
                >
                  {reportLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {reportLoading ? "Processing..." : "Reports"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={handleDownloadReport}
                  disabled={reportLoading}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSendReport}
                  disabled={reportLoading}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Main content */}
      <main className="container mx-auto px-6 py-6 max-w-7xl">
        {/* Report success toast */}
        {reportSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{reportSuccess}</span>
          </div>
        )}
        {manager ? (
          <Tabs defaultValue="overview" className="space-y-6">
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

            <TabsContent value="overview">
              <OverviewTab
                manager={manager}
                feedbacks={feedbacks}
                sentimentTrend={sentimentTrend}
                suggestions={suggestions}
                sugsLoading={sugsLoading}
                sugsError={sugsError}
                onGenerateSuggestions={handleGenerateSuggestions}
              />
            </TabsContent>

            <TabsContent value="employee-suggestions">
              <EmployeeSuggestionsTab
                coachingProfiles={coachingProfiles}
                teamMetrics={teamMetrics}
                employeeSuggestions={employeeSuggestions}
                currentScore={manager.effectivenessScore}
                loading={empSugLoading}
                coachingLoading={coachingLoading}
                onGenerate={handleGenerateEmployeeSuggestions}
                onToggleActionable={handleToggleActionable}
                attritionPredictions={attritionPredictions}
                attritionLoading={attritionLoading}
                onGenerateAttrition={handleGenerateAttrition}
                actionableProgress={actionableProgress}
              />
            </TabsContent>
            <TabsContent value="org-chart">
              <OrgChartTab manager={manager} employees={employees} coachingProfiles={coachingProfiles} attritionPredictions={attritionPredictions} />
            </TabsContent>
            <TabsContent value="leaderboard">
              <LeaderboardTab
                leaderboard={leaderboard}
                currentManagerId={manager.id}
                loading={leaderboardLoading}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-muted-foreground">Select a manager to view analytics.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
