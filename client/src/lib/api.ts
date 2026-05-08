import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export interface Employee {
  _id: string;
  id: string; // for compatibility
  name: string;
  email?: string;
  role: string;
  department?: string;
  joinDate?: string;
  performanceRating?: number; // Backend uses performanceRating
  performanceScore: number;   // Frontend uses performanceScore (mapped)
  status: "active" | "on-leave" | "probation"; // Default since backend doesn't have status yet
  feedbacks?: any[];
}

export interface AIScoreBreakdown {
  [key: string]: number;
  employeePerformance: number;
  feedbackSentiment: number;
  kpiMetrics: number;
  teamRetention: number;
  goalCompletion: number;
  employeePromotion: number;
  subordinate360: number;
  engagement: number;
  idpScore: number;
}

export interface Metric {
  _id: string;
  metricName: string;
  value: number;
  managerId: string;
}

export interface ExtendedMetrics {
  teamRetentionRate?: number;
  goalCompletionRate?: number;
  employeePromotionRate?: number;
  subordinate360Rating?: number;
  employeeEngagementScore?: number;
  IDP?: number;
}

export interface Manager {
  _id: string;
  id: string; // for compatibility
  name: string;
  department: string;
  effectivenessScore: number;
  sentimentScore: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative";
  totalEmployees: number;
  email?: string;
  experienceYears?: number;
  aiReasoning?: string;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
  aiBreakdown?: AIScoreBreakdown;
  extendedMetrics?: ExtendedMetrics;
}

export interface Feedback {
  _id: string;
  id: string;
  fromEmployee: string;
  employeeId: string;
  managerId: string;
  comment: string;
  sentimentScore: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative";
  date: string;
  pulseMood?: string;
  feedbackCategory?: string;
  feedbackType?: string;
  compositeFeedbackScore?: number;
  ratings?: {
    communication?: number;
    recognition?: number;
    availability?: number;
    careerGrowth?: number;
    empowerment?: number;
    fairness?: number;
    decisionMaking?: number;
    conflictResolution?: number;
  };
  npsScore?: number;
}

export interface AISuggestion {
  id?: string;
  category: "communication" | "leadership" | "delegation" | "growth" | "culture";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  predictedScore: number; // predicted effectiveness score after implementing this suggestion
}

export interface EmployeeSuggestionItem {
  title: string;
  description: string;
  focus: "performance" | "communication" | "collaboration" | "skills" | "initiative" | "wellbeing";
  actionables: EmployeeActionable[];
}

export interface EmployeeActionableImpact {
  performanceRatingDelta?: number;
  achievementScoreDelta?: number;
  runRateDelta?: number;
  feedbackSentimentDelta?: number;
  attritionRiskDelta?: number;
  managerScoreDelta?: number;
  goalCompletionRateDelta?: number;
  engagementScoreDelta?: number;
  teamRetentionRateDelta?: number;
  subordinate360RatingDelta?: number;
  idpDelta?: number;
}

export interface EmployeeActionable {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string | null;
  impact?: EmployeeActionableImpact;
  completionMetric?: string | null;
  completionNote?: string | null;
}

export interface EmployeeSuggestion {
  employeeName: string;
  employeeRole: string;
  currentRating: number;
  suggestions: EmployeeSuggestionItem[];
  predictedManagerScore: number;
  rationale: string;
}

function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildFallbackActionableImpact(focus: EmployeeSuggestionItem["focus"]): EmployeeActionableImpact {
  switch (focus) {
    case "communication":
      return { managerScoreDelta: 0.6, feedbackSentimentDelta: 0.03, attritionRiskDelta: -4 };
    case "collaboration":
      return { managerScoreDelta: 0.5, feedbackSentimentDelta: 0.025, attritionRiskDelta: -3 };
    case "skills":
      return { managerScoreDelta: 0.7, performanceRatingDelta: 0.1, achievementScoreDelta: 3 };
    case "initiative":
      return { managerScoreDelta: 0.7, runRateDelta: 4, achievementScoreDelta: 2.5 };
    case "wellbeing":
      return { managerScoreDelta: 0.8, feedbackSentimentDelta: 0.04, attritionRiskDelta: -7 };
    case "performance":
    default:
      return { managerScoreDelta: 0.8, performanceRatingDelta: 0.12, achievementScoreDelta: 4, runRateDelta: 3 };
  }
}

function normalizeEmployeeSuggestions(employeeSuggestions: any[]): EmployeeSuggestion[] {
  return (employeeSuggestions || []).map((employeeSuggestion: any, employeeIndex: number) => ({
    ...employeeSuggestion,
    suggestions: (employeeSuggestion.suggestions || []).map((suggestion: any, suggestionIndex: number) => {
      const focus = suggestion.focus || "performance";
      const baseId = slugify(`${employeeSuggestion.employeeName}-${employeeIndex}-${suggestionIndex}`);

      const normalizedActionables = (suggestion.actionables || []).map((actionable: any, actionableIndex: number) => ({
        ...actionable,
        id: actionable.id || actionable._id || `${baseId}-act-${actionableIndex}`
      }));

      return {
        ...suggestion,
        focus,
        actionables: normalizedActionables.length > 0
          ? normalizedActionables.slice(0, 1)
          : [
            {
              id: `${baseId}-act-0`,
              title: suggestion.title,
              description: suggestion.description,
              completed: false,
              completedAt: null,
              impact: buildFallbackActionableImpact(focus),
            },
          ],
      };
    }),
  }));
}

export interface AttritionPrediction {
  employeeName: string;
  flightRisk: number; // 0-100
  impactScore: number; // 0-100
  riskLevel: "High" | "Medium" | "Low";
  impactLevel: "High" | "Medium" | "Low";
  rationale: string;
  recommendation: string;
}

export interface Touchpoint {
  week: number;
  action: string;
  impact: "high" | "medium" | "low";
}

export interface ImprovementRoadmapItem {
  metricKey: string;
  metricLabel: string;
  currentScore: number;
  severity: "critical" | "warning";
  predictedReasons: string[];
  touchpoints: Touchpoint[];
  suggestion: string;
  milestoneTarget: number;
  estimatedWeeks: number;
}

export interface EmployeeCoachingProfile {
  _id: string;
  name: string;
  role: string;
  email?: string;
  performanceRating: number;
  achievementScore: number;
  runRate: number;
  attritionRisk: number;
  riskLevel: "High" | "Medium" | "Low";
  feedbackSentiment: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative";
  feedbackCount: number;
  pulseMood: string;
  avgRatings?: Record<string, number | null>;
}

export interface TeamCoachingMetrics {
  goalCompletionRate: number;
  totalDevGoals: number;
  avgDevGoalAssignment: number;
  devGoalStatus: "On Track" | "At Risk" | "Behind";
  teamRetentionRate: number;
  engagementScore: number;
  promotionRate: number;
  subordinate360Rating: number;
}

export interface ActionableProgress {
  completed: number;
  total: number;
  completionRate: number;
}

export interface SentimentTrendMonth {
  avg: number | null;
  count: number;
  label: string;
}

export interface SentimentTrend {
  currentMonth: SentimentTrendMonth;
  previousMonth: SentimentTrendMonth;
  delta: number | null;
  direction: "up" | "down" | "unchanged";
}

export interface ScoreSnapshot {
  _id: string;
  managerId: string;
  finalScore: number;
  breakdown: {
    avgEmployeeScore: number;
    avgFeedbackScore: number;
    avgMetricScore: number;
  };
  category: string;
  counts: {
    employees: number;
    feedbacks: number;
    metrics: number;
  };
  createdAt: string;
  aiScore?: number;
  aiBreakdown?: AIScoreBreakdown;
  aiReasoning?: string;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
}

// Helper to derive label from score
function getSentimentLabel(score: number): "Positive" | "Neutral" | "Negative" {
  if (score >= 0.6) return "Positive";
  if (score <= 0.4) return "Negative";
  return "Neutral";
}

// ========== API FUNCTIONS ==========

export async function fetchManagers(): Promise<Manager[]> {
  const res = await api.get("/managers");
  return res.data.map((m: any) => ({
    _id: m._id,
    id: m._id,
    name: m.name,
    department: m.department,
    email: m.email,
    experienceYears: m.experienceYears,
    effectivenessScore: 50,
    sentimentScore: 0.5,
    sentimentLabel: "Neutral",
    totalEmployees: 0
  }));
}

export async function fetchManager(managerId?: string): Promise<Manager> {
  let mgr;

  if (managerId) {
    const resAnalytics = await api.get(`/manager-analytics/${managerId}`);
    const analytics = resAnalytics.data;
    mgr = analytics.manager;

    return {
      _id: mgr._id,
      id: mgr._id,
      name: mgr.name,
      department: mgr.department,
      email: mgr.email,
      experienceYears: mgr.experienceYears,
      effectivenessScore: analytics.finalScore || 0,
      sentimentScore: (analytics.breakdown?.feedbackSentiment !== undefined
        ? analytics.breakdown.feedbackSentiment / 100
        : (analytics.breakdown?.avgFeedbackScore ?? 0)),
      sentimentLabel: getSentimentLabel((analytics.breakdown?.feedbackSentiment !== undefined
        ? analytics.breakdown.feedbackSentiment / 100
        : (analytics.breakdown?.avgFeedbackScore ?? 0))),
      totalEmployees: analytics.counts?.employees || 0,
      aiReasoning: analytics.aiReasoning,
      aiStrengths: analytics.aiStrengths,
      aiWeaknesses: analytics.aiWeaknesses,
      aiBreakdown: analytics.aiBreakdown,
      extendedMetrics: analytics.extendedMetrics,
    };
  } else {
    const managers = await fetchManagers();
    if (managers.length === 0) {
      throw new Error("No managers found");
    }
    return fetchManager(managers[0]._id);
  }
}

export async function fetchEmployees(managerId: string): Promise<Employee[]> {
  const res = await api.get(`/employees/manager/${managerId}`);
  return res.data.map((e: any) => ({
    _id: e._id,
    id: e._id,
    name: e.name,
    role: e.role,
    performanceRating: e.performanceRating,
    performanceScore: (e.performanceRating / 5) * 100,
    status: "active",
    feedbacks: e.feedbacks || []
  }));
}

export async function fetchFeedbacks(managerId: string, page: number = 1, limit: number = 50): Promise<Feedback[]> {
  const res = await api.get(`/feedback/manager/${managerId}?page=${page}&limit=${limit}`);
  const data = res.data;
  const feedbackList = data.feedbacks ?? data;

  if (!Array.isArray(feedbackList)) return [];

  return feedbackList.map((f: any) => ({
    _id: f._id,
    id: f._id,
    fromEmployee: f.fromEmployee,
    managerId: f.managerId,
    comment: f.comment,
    sentimentScore: f.sentimentScore,
    sentimentLabel: getSentimentLabel(f.sentimentScore),
    date: f.createdAt,
    employeeId: f.employeeId || "unknown",
    compositeFeedbackScore: f.compositeFeedbackScore,
    ratings: f.ratings,
    npsScore: f.npsScore,
    pulseMood: f.pulseMood,
    feedbackType: f.feedbackType,
    feedbackCategory: f.feedbackCategory
  }));
}

export async function fetchMetrics(managerId: string): Promise<Metric[]> {
  const res = await api.get(`/metrics/manager/${managerId}`);
  return res.data;
}

export async function fetchAISuggestions(managerId: string): Promise<AISuggestion[]> {
  const res = await api.post(`/manager-analytics/${managerId}/suggestions`);
  const raw = res.data.suggestions || [];
  return raw.map((s: any) => ({
    ...s,
    predictedScore: s.predictedScore ?? s.expectedImpact ?? 0,
  }));
}

export async function fetchEmployeeSuggestions(
  managerId: string,
  regenerate: boolean = false
): Promise<{ employeeSuggestions: EmployeeSuggestion[]; currentScore: number; progress?: ActionableProgress; cached?: boolean }> {
  const res = await api.post(`/manager-analytics/${managerId}/employee-suggestions`, { regenerate });
  return {
    employeeSuggestions: normalizeEmployeeSuggestions(res.data.employeeSuggestions || []),
    currentScore: res.data.currentScore || 0,
    progress: res.data.progress,
    cached: res.data.cached,
  };
}

export async function updateEmployeeActionable(
  managerId: string,
  actionableId: string,
  completed: boolean,
  completion?: {
    impact?: EmployeeActionableImpact;
    completionMetric?: string;
    completionNote?: string;
    formData?: Record<string, unknown>;
  }
): Promise<{
  manager?: Manager;
  employeeSuggestions: EmployeeSuggestion[];
  coachingProfiles?: EmployeeCoachingProfile[];
  teamMetrics?: TeamCoachingMetrics;
  attritionPredictions?: AttritionPrediction[];
  currentScore: number;
  scoreDelta?: number;
  progress?: ActionableProgress;
}> {
  const res = await api.patch(`/manager-analytics/${managerId}/employee-suggestions/actionables/${actionableId}`, {
    completed,
    ...(completion || {}),
  });
  const rawSentiment = res.data.manager?.sentimentScore ?? 0;
  const manager = res.data.manager
    ? {
      _id: res.data.manager._id,
      id: res.data.manager._id,
      name: res.data.manager.name,
      department: res.data.manager.department,
      email: res.data.manager.email,
      experienceYears: res.data.manager.experienceYears,
      effectivenessScore: res.data.currentScore || res.data.manager.effectivenessScore || 0,
      sentimentScore: rawSentiment,
      sentimentLabel: getSentimentLabel(rawSentiment),
      totalEmployees: res.data.coachingProfiles?.length || 0,
    }
    : undefined;
  return {
    manager,
    employeeSuggestions: normalizeEmployeeSuggestions(res.data.employeeSuggestions || []),
    coachingProfiles: res.data.coachingProfiles || [],
    teamMetrics: res.data.teamMetrics || {},
    attritionPredictions: res.data.attritionPredictions || [],
    currentScore: res.data.currentScore || 0,
    scoreDelta: res.data.scoreDelta || 0,
    progress: res.data.progress,
  };
}

export async function fetchAttritionPredictions(
  managerId: string
): Promise<AttritionPrediction[]> {
  const res = await api.post(`/manager-analytics/${managerId}/attrition-risk`);
  return res.data.predictions || [];
}

export async function fetchImprovementRoadmap(
  managerId: string,
  regenerate: boolean = false
): Promise<{ roadmap: ImprovementRoadmapItem[]; message?: string; cached?: boolean }> {
  const res = await api.post(`/manager-analytics/${managerId}/improvement-roadmap`, { regenerate });
  return {
    roadmap: res.data.roadmap || [],
    message: res.data.message,
    cached: res.data.cached,
  };
}

export async function fetchEmployeeCoaching(
  managerId: string
): Promise<{ employees: EmployeeCoachingProfile[]; teamMetrics: TeamCoachingMetrics; progress?: ActionableProgress }> {
  const res = await api.get(`/manager-analytics/${managerId}/employee-coaching`);
  return {
    employees: res.data.employees || [],
    teamMetrics: res.data.teamMetrics || {},
    progress: res.data.progress,
  };
}


// Manager-facing leaderboard (peers under the same HR)
export async function fetchManagerLeaderboard(managerId: string): Promise<LeaderboardEntry[]> {
  const res = await api.get(`/manager-analytics/${managerId}/leaderboard`);
  return res.data;
}

export async function fetchPeerTrendBenchmark(
  managerId: string,
  months: number = 12
): Promise<PeerTrendBenchmark> {
  const res = await api.get(`/manager-analytics/${managerId}/peer-trends`, {
    params: { months },
  });
  return res.data;
}

export default api;

// ========== SCORE SNAPSHOTS (Historical Trend) ==========

export async function fetchScoreSnapshots(
  managerId: string,
  months: number = 12
): Promise<ScoreSnapshot[]> {
  const res = await api.get(`/score-snapshots/${managerId}`, {
    params: { months },
  });
  return res.data;
}

export async function fetchSentimentTrend(managerId: string): Promise<SentimentTrend> {
  const res = await api.get(`/feedback/manager/${managerId}/sentiment-trend`);
  return res.data;
}

// ========== HR API ==========

export interface HRManager {
  _id: string;
  name: string;
  department: string;
  email: string;
  experienceYears: number;
  effectivenessScore: number;
  sentimentScore: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative";
  category: string;
  extendedMetrics?: ExtendedMetrics;
  breakdown: {
    avgEmployeeScore: number;
    avgFeedbackScore: number;
    avgMetricScore: number;
  };
  counts: {
    employees: number;
    feedbacks: number;
    metrics: number;
  };
}

export interface HROverview {
  totalManagers: number;
  totalEmployees: number;
  totalFeedbacks: number;
  avgEffectiveness: number;
  avgSentiment: number;
}

export interface HierarchyEmployee {
  id: string;
  name: string;
  role: string;
  performanceRating: number;
  ees: number;
  email: string;
}

export interface HierarchyManager {
  id: string;
  name: string;
  department: string;
  email: string;
  experienceYears: number;
  effectivenessScore: number;
  category: string;
  sentimentScore: number;
  employees: HierarchyEmployee[];
}

export interface HierarchyData {
  hr: {
    id: string;
    name: string;
    email: string;
    department: string;
    designation: string;
  };
  managers: HierarchyManager[];
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  department: string;
  email: string;
  experienceYears: number;
  effectivenessScore: number;
  sentimentScore: number;
  category: string;
  counts: {
    employees: number;
    feedbacks: number;
    metrics: number;
  };
  trend: number;
}

export interface PeerTrendPoint {
  monthKey: string;
  label: string;
  score: number | null;
}

export interface PeerTrendSeries {
  key: "self" | "top" | "above" | "below" | "peer_avg";
  relation: "self" | "top" | "above" | "below" | "peer_avg";
  managerId: string | null;
  name: string;
  rank: number | null;
  latestScore: number | null;
  points: PeerTrendPoint[];
}

export interface PeerTrendSummary {
  rank: number;
  totalPeers: number;
  topPercentile: number;
  tier: "Champion" | "Elite" | "Contender" | "Rising";
  currentScore: number;
  category: string;
  scoreGapToTop: number;
  scoreGapToNext: number;
  scoreLeadOverBelow: number;
  nextManagerName: string | null;
  belowManagerName: string | null;
  abovePeerAverageStreak: number;
}

export interface PeerTrendBenchmark {
  timeframe: {
    months: number;
    start: string | null;
    end: string | null;
  };
  summary: PeerTrendSummary | null;
  series: PeerTrendSeries[];
}

export async function fetchHRManagers(hrId: string): Promise<HRManager[]> {
  const res = await api.get(`/hr/${hrId}/managers`);
  return res.data;
}

export async function fetchHROverview(hrId: string): Promise<HROverview> {
  const res = await api.get(`/hr/${hrId}/overview`);
  return res.data;
}

export async function fetchHierarchy(hrId: string): Promise<HierarchyData> {
  const res = await api.get(`/hr/${hrId}/hierarchy`);
  return res.data;
}

export async function fetchLeaderboard(hrId: string): Promise<LeaderboardEntry[]> {
  const res = await api.get(`/hr/${hrId}/leaderboard`);
  return res.data;
}

export const downloadReport = async (hrId: string): Promise<void> => {
  const response = await api.get(`/hr/${hrId}/download-report`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HR_Report_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const sendReports = async (hrId: string): Promise<{ message: string }> => {
  const response = await api.post(`/hr/${hrId}/send-reports`);
  return response.data;
};

export const sendManagerReport = async (hrId: string, managerId: string): Promise<{ message: string }> => {
  const response = await api.post(`/hr/${hrId}/send-report/${managerId}`);
  return response.data;
};

export const downloadManagerReport = async (managerId: string): Promise<void> => {
  const response = await api.get(`/manager-analytics/${managerId}/download-report`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/html" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Manager_Report_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const sendManagerSelfReport = async (managerId: string): Promise<{ message: string }> => {
  const response = await api.post(`/manager-analytics/${managerId}/send-report`);
  return response.data;
};

export interface PeerComparisonResult {
  peerAdvantages: {
    area: string;
    peerStrength: string;
    yourGap: string;
    actionItem: string;
    impact: "high" | "medium" | "low";
  }[];
  scoreSummary: {
    yourScore: number;
    peerScore: number;
    gap: number;
    topDifferentiators: string[];
  };
  overallInsight: string;
}

export async function fetchPeerComparison(managerId: string, peerId: string): Promise<PeerComparisonResult> {
  const response = await api.post(`/manager-analytics/${managerId}/peer-comparison`, { peerId });
  return response.data;
}

export interface TeamsEmployeeSentiment {
  employeeId: string | null;
  employeeName: string;
  role: string;
  meetingCount: number;
  chatCount: number;
  overallSentiment: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative";
  emotionalState: string;
  keyThemes: string[];
  topConcern: string | null;
  positiveSignal: string | null;
  riskFlag: boolean;
  summary: string;
}

export interface TeamsSentimentResult {
  teamSentiment: number;
  teamSentimentLabel: "Positive" | "Neutral" | "Negative";
  employeesAnalyzed: number;
  riskCount: number;
  employees: TeamsEmployeeSentiment[];
  analyzedAt?: string;
}

export async function fetchTeamsSentiment(managerId: string): Promise<TeamsSentimentResult> {
  const response = await api.get(`/manager-analytics/${managerId}/teams-sentiment`);
  return response.data;
}

export async function fetchTeamsSentimentCache(managerId: string): Promise<TeamsSentimentResult | null> {
  const response = await api.get(`/manager-analytics/${managerId}/teams-sentiment-cache`);
  return response.data;
}
