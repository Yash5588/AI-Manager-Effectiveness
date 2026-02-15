import axios from "axios";

// Use REACT_APP_API_URL or proxy; fallback to backend on port 5000 (CORS enabled)
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Managers
export const getManagers = () => api.get("/managers");

// Manager Analytics
export const getManagerAnalytics = (managerId) =>
  api.get(`/manager-analytics/${managerId}`);

// Generate AI suggestions (on-demand, sends full Mongo data to AI)
export const generateManagerSuggestions = (managerId) =>
  api.post(`/manager-analytics/${managerId}/suggestions`);

// Get employees by manager
export const getEmployeesByManager = (managerId) =>
  api.get(`/employees/manager/${managerId}`);

export default api;
