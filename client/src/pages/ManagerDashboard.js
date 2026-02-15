import React, { useState, useEffect, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { getManagers, getManagerAnalytics, generateManagerSuggestions } from "../services/api";
import "./ManagerDashboard.css";

ChartJS.register(ArcElement, Tooltip);

const DEFAULT_WEIGHTS = { employee: 0.4, feedback: 0.3, metrics: 0.3 };
const TABS = ["Overview", "Suggestions", "Manager Details"];

function computeFinalScore(breakdown) {
  if (!breakdown) return 0;
  const { avgEmployeeScore, avgFeedbackScore, avgMetricScore } = breakdown;
  const w = DEFAULT_WEIGHTS;
  const raw =
    avgEmployeeScore * w.employee +
    avgFeedbackScore * w.feedback +
    avgMetricScore * w.metrics;
  return Math.round(raw * 100);
}

function getCategory(finalScore) {
  if (finalScore >= 85) return "Excellent";
  if (finalScore >= 70) return "Good";
  if (finalScore >= 50) return "Average";
  return "Needs Improvement";
}

function ManagerDashboard() {
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [suggestions, setSuggestions] = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);

  const fetchManagers = useCallback(async () => {
    try {
      const res = await getManagers();
      setManagers(res.data);
      setSelectedManagerId((prev) => (prev ? prev : res.data[0]?._id ?? ""));
    } catch (err) {
      setError(err.message || "Failed to load managers");
    }
  }, []);

  const fetchAnalytics = useCallback(async (managerId) => {
    if (!managerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getManagerAnalytics(managerId);
      setAnalytics(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load analytics");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, []);

  useEffect(() => {
    if (selectedManagerId) fetchAnalytics(selectedManagerId);
  }, [selectedManagerId, fetchAnalytics]);

  useEffect(() => {
    setSuggestions(null);
    setSuggestionsError(null);
  }, [selectedManagerId]);

  const handleGenerateSuggestions = async () => {
    if (!selectedManagerId) return;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await generateManagerSuggestions(selectedManagerId);
      setSuggestions(res.data.suggestions || []);
    } catch (err) {
      setSuggestionsError(err.response?.data?.message || err.message || "Failed to generate suggestions");
      setSuggestions(null);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const finalScore = analytics ? computeFinalScore(analytics.breakdown) : 0;
  const category = getCategory(finalScore);

  const categoryClass = {
    Excellent: "badge-excellent",
    Good: "badge-good",
    Average: "badge-average",
    "Needs Improvement": "badge-needs-improvement",
  };

  const breakdownItems = analytics
    ? [
        { label: "Employee Performance", score: analytics.breakdown.avgEmployeeScore * 100, color: "#4ade80" },
        { label: "Team Feedback", score: analytics.breakdown.avgFeedbackScore * 100, color: "#60a5fa" },
        { label: "Metrics", score: analytics.breakdown.avgMetricScore * 100, color: "#a78bfa" },
      ]
    : [];

  return (
    <div className="manager-dashboard">
      <header className="dashboard-header">
        <h1>Manager Performance Dashboard</h1>
        <p className="subtitle">AI Manager Effectiveness Scoring</p>
      </header>

      <div className="manager-selector">
        <label htmlFor="manager-select">Select Manager</label>
        <select
          id="manager-select"
          value={selectedManagerId}
          onChange={(e) => setSelectedManagerId(e.target.value)}
          disabled={loading}
        >
          <option value="">-- Choose a manager --</option>
          {managers.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name} — {m.department}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading">Loading analytics...</div>}

      {!loading && analytics && (
        <>
          <nav className="tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "tab-active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="tab-content">
            {activeTab === "Overview" && (
              <div className="card overview-card">
                <div className="overview-score">
                  <div className="score-display">
                    <Doughnut
                      data={{
                        labels: ["Score", "Remaining"],
                        datasets: [
                          {
                            data: [finalScore, 100 - finalScore],
                            backgroundColor: ["#3b82f6", "#e5e7eb"],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        circumference: 180,
                        rotation: 270,
                        cutout: "75%",
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                      }}
                    />
                    <div className="score-value">{finalScore}</div>
                  </div>
                  <div className="score-meta">
                    <span className={`badge ${categoryClass[category] || ""}`}>{category}</span>
                    <p className="score-label">Effectiveness Score (0–100)</p>
                  </div>
                </div>
                <div className="breakdown-summary">
                  <h4>Score Components</h4>
                  {breakdownItems.map((item) => (
                    <div key={item.label} className="breakdown-row">
                      <span className="breakdown-label">{item.label}</span>
                      <div className="breakdown-bar-wrap">
                        <div
                          className="breakdown-bar"
                          style={{ width: `${item.score}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <span className="breakdown-value">{Math.round(item.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Suggestions" && (
              <div className="card suggestions-card">
                <div className="suggestions-header">
                  <div className="suggestions-title-wrap">
                    <h3>AI Improvement Suggestions</h3>
                    <span className="ai-badge">Explainable AI</span>
                  </div>
                  <p className="suggestions-desc">
                    Generate personalized, data-driven recommendations from manager profile, employees, feedback, and metrics.
                  </p>
                </div>
                <div className="suggestions-actions">
                  <button
                    className="btn-generate"
                    onClick={handleGenerateSuggestions}
                    disabled={suggestionsLoading}
                  >
                    {suggestionsLoading ? (
                      <>
                        <span className="spinner" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <span className="btn-icon">✨</span>
                        Generate AI Suggestions
                      </>
                    )}
                  </button>
                </div>
                {suggestionsError && (
                  <div className="suggestions-error">{suggestionsError}</div>
                )}
                {suggestionsLoading && !suggestions && (
                  <div className="suggestions-skeleton">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-card" />
                    ))}
                  </div>
                )}
                {!suggestionsLoading && suggestions && suggestions.length > 0 && (
                  <div className="suggestions-list">
                    {suggestions.map((s, i) => (
                      <div key={i} className="suggestion-card">
                        <span className="suggestion-num">{i + 1}</span>
                        <p className="suggestion-text">{s}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!suggestionsLoading && !suggestions && !suggestionsError && (
                  <div className="suggestions-empty">
                    <span className="empty-icon">💡</span>
                    <p>Click the button above to generate AI-powered suggestions based on this manager&apos;s full analytics data.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Manager Details" && analytics.manager && (
              <div className="card manager-info">
                <h3>Manager Profile</h3>
                <dl className="manager-details">
                  <dt>Name</dt>
                  <dd>{analytics.manager.name}</dd>
                  <dt>Department</dt>
                  <dd>{analytics.manager.department}</dd>
                  <dt>Experience</dt>
                  <dd>{analytics.manager.experienceYears} years</dd>
                  <dt>Data Points</dt>
                  <dd>
                    {analytics.counts?.employees || 0} employees, {analytics.counts?.feedbacks || 0} feedback
                    entries, {analytics.counts?.metrics || 0} metrics
                  </dd>
                </dl>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ManagerDashboard;
