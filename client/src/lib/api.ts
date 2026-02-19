import axios from "axios";

// API Service Layer - Replace BASE_URL with your Antigravity backend URL
// All functions return mock data currently. Swap with real fetch calls when ready.

// Using Vite proxy or direct URL
const BASE_URL = "http://localhost:5000/api";

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
}

export interface Feedback {
  _id: string;
  id: string; // compatibility
  employeeId?: string;
  employeeName: string; // 'fromEmployee' in backend
  managerId: string;
  text: string; // 'comment' in backend
  sentimentScore: number;
  sentimentLabel: "Positive" | "Neutral" | "Negative"; // derived
  date: string; // createdAt
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
  focus: "performance" | "communication" | "collaboration" | "skills" | "initiative";
}

export interface EmployeeSuggestion {
  employeeName: string;
  employeeRole: string;
  currentRating: number;
  suggestions: EmployeeSuggestionItem[];
  predictedManagerScore: number;
  rationale: string;
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
    effectivenessScore: 0,
    sentimentScore: 0,
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
      sentimentScore: analytics.breakdown?.avgFeedbackScore || 0,
      sentimentLabel: getSentimentLabel(analytics.breakdown?.avgFeedbackScore || 0),
      totalEmployees: analytics.counts?.employees || 0,
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

export async function fetchFeedbacks(managerId: string): Promise<Feedback[]> {
  const res = await api.get(`/feedback/manager/${managerId}`);
  return res.data.map((f: any) => ({
    _id: f._id,
    id: f._id,
    employeeName: f.fromEmployee,
    managerId: f.managerId,
    text: f.comment,
    sentimentScore: f.sentimentScore,
    sentimentLabel: getSentimentLabel(f.sentimentScore),
    date: f.createdAt,
    employeeId: f.employeeId || "unknown"
  }));
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
  managerId: string
): Promise<{ employeeSuggestions: EmployeeSuggestion[]; currentScore: number }> {
  const res = await api.post(`/manager-analytics/${managerId}/employee-suggestions`);
  return {
    employeeSuggestions: res.data.employeeSuggestions || [],
    currentScore: res.data.currentScore || 0,
  };
}

export default api;

