const OpenAI = require("openai").default;

// OpenRouter client
const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Manager Effectiveness",
  },
});

// Rate-limit guard
let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

// Parse JSON array from AI response
function safeParseJSONArray(text) {
  try {
    if (!text) return null;

    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");

    if (start === -1 || end === -1) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function generateAISuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    const wait = MIN_DELAY_MS - (now - lastCallTime);
    console.log(`⏱ AI Throttle: Waiting ${wait}ms...`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastCallTime = Date.now();

  const {
    manager,
    employees = [],
    feedbacks = [],
    metrics = [],
    breakdown = {},
    finalScore,
    category,
  } = payload;

  if (!manager) {
    throw new Error("Manager data is required for AI suggestions");
  }

  const employeePct = Math.round((breakdown.avgEmployeeScore ?? 0.5) * 100);
  const feedbackPct = Math.round((breakdown.avgFeedbackScore ?? 0.5) * 100);
  const metricsPct = Math.round((breakdown.avgMetricScore ?? 0.5) * 100);

  const employeesSummary =
    employees.length > 0
      ? employees
        .map(
          (e) =>
            `- ${e?.name ?? "N/A"} (${e?.role ?? "N/A"}): rating ${e?.performanceRating ?? "?"}/5`
        )
        .join("\n")
      : "No employees on record.";

  const feedbacksSummary =
    feedbacks.length > 0
      ? feedbacks
        .map((f) => {
          let line = `- "Anonymous Feedback": "${f?.comment ?? ""}" (sentiment: ${Math.round(
            (f?.sentimentScore ?? 0) * 100
          )}%, composite: ${Math.round((f?.compositeFeedbackScore ?? f?.sentimentScore ?? 0) * 100)}%)`;
          if (f?.ratings) {
            const rKeys = Object.entries(f.ratings).filter(([, v]) => v != null);
            if (rKeys.length > 0) {
              line += ` [Ratings: ${rKeys.map(([k, v]) => `${k}=${v}/5`).join(", ")}]`;
            }
          }
          if (f?.npsScore != null) line += ` [NPS: ${f.npsScore}/10]`;
          if (f?.pulseMood) line += ` [Mood: ${f.pulseMood}]`;
          if (f?.feedbackCategory) line += ` [Category: ${f.feedbackCategory}]`;
          if (f?.feedbackType) line += ` [Type: ${f.feedbackType}]`;
          return line;
        })
        .join("\n")
      : "No feedback on record.";

  const metricsSummary =
    metrics.length > 0
      ? metrics.map((m) => `- ${m?.metricName ?? "N/A"}: ${m?.value ?? "?"}`).join("\n")
      : "No metrics on record.";

  const prompt = `
You are an expert management coach.

Analyze the manager data below and generate 4–6 actionable improvement suggestions.

STRICT RULES:
- Output ONLY a valid JSON array of objects.
- Each object must have the following fields:
  - "category": one of ["communication", "leadership", "delegation", "growth", "culture"]
  - "title": string (short title)
  - "description": string (1-2 sentences)
  - "priority": one of ["high", "medium", "low"]
  - "predictedScore": number (This is the NEW overall effectiveness score out of 100 AFTER implementing the suggestion. The current score is ${finalScore ?? 0}. The predictedScore MUST BE strictly GREATER THAN ${finalScore ?? 0}. For example, if the current score is 72, the predictedScore should be between 73 and 100.)
- Each suggestion MUST show improvement.
- No markdown
- No explanations

Manager: ${manager?.name ?? "Unknown"}
Department: ${manager?.department ?? "Unknown"}
Experience: ${manager?.experienceYears ?? 0} years

Overall Score: ${finalScore ?? 0}/100 (${category ?? "Unknown"})

Breakdown:
- Employee Performance: ${employeePct}
- Feedback Sentiment: ${feedbackPct}
- Metrics Score: ${metricsPct}

Employees:
${employeesSummary}

Feedback:
${feedbacksSummary}

Metrics:
${metricsSummary}
`.trim();

  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-12b-it:free",
    "qwen/qwen3-coder:free"
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 AI model:", model);

      const completion =
        await openRouterClient.chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 800,
        });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed) {
        return parsed.map((s) => {
          const current = finalScore ?? 0;
          let predicted = Number(s.predictedScore);

          if (isNaN(predicted) || predicted <= current) {
            predicted = Math.min(100, current + Math.floor(Math.random() * 8) + 4);
          }

          return {
            ...s,
            predictedScore: predicted,
          };
        });
      }
    } catch (err) {
      console.error(`❌ Model ${model} failed:`, err.message);
      if (err.response) {
        console.error("Response data:", JSON.stringify(err.response.data));
      }
      lastError =
        err?.response?.data?.error?.message ||
        err?.error?.message ||
        err?.message ||
        String(err);
      console.warn(`⚠️ Model failed: ${model}`, lastError);
    }
  }

  const msg = lastError
    ? `AI failed: ${lastError}`
    : "AI failed on all models";
  throw new Error(msg);
}

async function generateEmployeeSuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
  }
  lastCallTime = Date.now();

  const {
    manager,
    coachingProfiles = [],
    teamMetrics = {},
    feedbacks = [],
    finalScore,
  } = payload;

  if (!manager) {
    throw new Error("Manager data is required for employee suggestions");
  }

  // Build per-employee detail blocks with full talent profile
  const employeeDetails = coachingProfiles
    .map((emp) => {
      const empFeedbacks = feedbacks.filter(
        (f) => f.fromEmployee === emp.name || f.employeeId?.toString() === emp._id?.toString()
      );
      const feedbackText =
        empFeedbacks.length > 0
          ? empFeedbacks
            .slice(0, 3)
            .map(
              (f) =>
                `    - "${f?.comment ?? ""}" (sentiment: ${Math.round(
                  (f?.sentimentScore ?? 0) * 100
                )}%, mood: ${f?.pulseMood || "N/A"})`
            )
            .join("\n")
          : "    - No feedback available.";

      // Ratings breakdown
      const ratingsText = emp.avgRatings
        ? Object.entries(emp.avgRatings)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k}: ${v}/5`)
          .join(", ")
        : "No ratings";

      return `  ──── ${emp.name} (${emp.role}) ────
  Performance Rating: ${emp.performanceRating}/5
  Achievement Score: ${emp.achievementScore}%
  Run Rate: ${emp.runRate}%
  Attrition Risk: ${emp.attritionRisk}% (${emp.riskLevel})
  Feedback Sentiment: ${Math.round(emp.feedbackSentiment * 100)}% (${emp.sentimentLabel})
  Pulse Mood: ${emp.pulseMood}
  Feedback Count: ${emp.feedbackCount}
  Ratings Breakdown: ${ratingsText}
  Recent Feedback:
${feedbackText}`;
    })
    .join("\n\n");

  const prompt = `
You are an expert performance coach specializing in personalized employee development.

For EACH employee below, generate 2-3 coaching suggestions specific to THAT EMPLOYEE's own career growth, performance improvement, and professional development.

KEY RULES:
- Suggestions must be EMPLOYEE-SCOPED — focus on what THIS specific employee should work on to grow.
- Use each employee's metrics to identify their weak areas:
  * Low Achievement Score (< 60%) → needs performance improvement
  * Low Run Rate (< 50%) → needs better goal velocity and execution speed
  * High Attrition Risk (> 60%) → needs engagement, motivation, and career path clarity
  * Negative Sentiment (< 40%) → has concerns that need addressing
  * Low category ratings (< 3/5) → specific skill gaps to address
  * Stressed/Struggling mood → needs wellbeing support
- High performers (achievement > 75%) should get growth/stretch suggestions, not basic improvement.
- Reference specific data points in your rationale.

STRICT OUTPUT FORMAT — Return ONLY a valid JSON array:
[
  {
    "employeeName": "Name",
    "employeeRole": "Role",
    "currentRating": <number 1-5>,
    "suggestions": [
      {
        "title": "Short actionable title",
        "description": "1-2 sentences: what the employee should do and why, referencing their specific metrics",
        "focus": "performance" | "communication" | "collaboration" | "skills" | "initiative" | "wellbeing"
      }
    ],
    "predictedRatingBoost": <number 0.1-1.0, expected rating improvement if suggestions are followed>,
    "rationale": "1 sentence citing specific metrics that drove these suggestions"
  }
]

No markdown, no extra text — ONLY the JSON array.

Manager: ${manager?.name ?? "Unknown"} (${manager?.department ?? "Unknown"})
Team Size: ${coachingProfiles.length} employees

Team Context:
- Goal Completion: ${teamMetrics.goalCompletionRate ?? 0}%
- Dev Goals: ${teamMetrics.totalDevGoals ?? 0} total (avg ${teamMetrics.avgDevGoalAssignment ?? 0}/employee)
- Dev Goal Status: ${teamMetrics.devGoalStatus ?? "Unknown"}
- Team Engagement: ${teamMetrics.engagementScore ?? 0}%
- Team Retention: ${teamMetrics.teamRetentionRate ?? 0}%

Employee Talent Profiles:
${employeeDetails}
`.trim();

  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-12b-it:free",
    "qwen/qwen3-coder:free"
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 Employee coaching AI model:", model);

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed) {
        return parsed.map((emp) => ({
          ...emp,
          predictedRatingBoost: emp.predictedRatingBoost || 0.5,
          // Map to legacy field for frontend compatibility
          predictedManagerScore: Math.min(100, (finalScore ?? 0) + Math.floor(Math.random() * 5) + 2),
        }));
      }
    } catch (err) {
      console.error(`❌ Employee Model ${model} failed:`, err.message);
      if (err.response) {
        console.error("Response data:", JSON.stringify(err.response.data));
      }
      lastError =
        err?.response?.data?.error?.message ||
        err?.error?.message ||
        err?.message ||
        String(err);
      console.warn(`⚠️ Model failed: ${model}`, lastError);
    }
  }

  const msg = lastError
    ? `AI failed: ${lastError}`
    : "AI failed on all models";
  throw new Error(msg);
}

async function analyzeSentiment(comment) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    const wait = MIN_DELAY_MS - (now - lastCallTime);
    console.log(`⏱ Sentiment Throttle: Waiting ${wait}ms...`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastCallTime = Date.now();

  const prompt = `
You are a sentiment analysis expert. Analyze the following employee feedback comment and return ONLY a single JSON object with one field:
- "sentimentScore": a number between 0 and 1 where 0 = very negative, 0.5 = neutral, 1 = very positive

No markdown, no explanation, ONLY the JSON object.

Feedback: "${comment}"
`.trim();

  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-12b-it:free",
    "qwen/qwen3-coder:free"
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 Sentiment model:", model);

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 100,
      });

      const content = completion?.choices?.[0]?.message?.content;
      if (content) {
        const cleaned = content
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
          const score = Number(parsed.sentimentScore);
          if (!isNaN(score) && score >= 0 && score <= 1) {
            return Math.round(score * 100) / 100;
          }
        }

        //safe case if json not parsed
        const numMatch = cleaned.match(/0?\.\d+/);
        if (numMatch) {
          const score = Number(numMatch[0]);
          if (score >= 0 && score <= 1) return Math.round(score * 100) / 100;
        }
      }
    } catch (err) {
      console.error(`❌ Sentiment Model ${model} failed:`, err.message);
      lastError = err?.message || String(err);
    }
  }

  console.warn("⚠️ All sentiment models failed, defaulting to 0.5");
  return 0.5;
}

// Generate a structured improvement roadmap for all weak metrics (score < 60)
async function generateImprovementRoadmap(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
  }
  lastCallTime = Date.now();

  const {
    manager,
    feedbacks = [],
    breakdown = {},
    extendedMetrics = {},
    finalScore,
  } = payload;

  if (!manager) {
    throw new Error("Manager data is required for improvement roadmap");
  }

  // Label maps
  const breakdownLabels = {
    employeePerformance: "Employee Performance",
    feedbackSentiment: "Feedback Sentiment",
    kpiMetrics: "KPI Metrics",
    teamRetention: "Team Retention",
    goalCompletion: "Goal Completion",
    employeePromotion: "Employee Promotion",
    subordinate360: "360° Subordinate Rating",
    engagement: "Engagement",
    idpScore: "IDP (Dev Goals)",
  };

  const extendedLabels = {
    teamRetentionRate: "Team Retention Rate",
    goalCompletionRate: "Goal Completion Rate",
    employeePromotionRate: "Employee Promotion Rate",
    subordinate360Rating: "360° Subordinate Rating",
    employeeEngagementScore: "Employee Engagement Score",
  };

  // Collect weak metrics (< 60)
  const weakMetrics = [];
  for (const [key, value] of Object.entries(breakdown)) {
    if (breakdownLabels[key] && typeof value === "number" && value < 60) {
      weakMetrics.push({ key, label: breakdownLabels[key], score: value, source: "breakdown" });
    }
  }
  for (const [key, value] of Object.entries(extendedMetrics)) {
    if (extendedLabels[key] && typeof value === "number" && value < 60) {
      weakMetrics.push({ key, label: extendedLabels[key], score: value, source: "extended" });
    }
  }

  if (weakMetrics.length === 0) {
    return { roadmap: [], message: "All metrics are healthy — no weak areas detected!" };
  }

  // Summarize recent feedback for context
  const recentFeedback = feedbacks.slice(0, 15).map((f) => {
    const score = f?.sentimentScore ?? 0;
    const label = score >= 0.6 ? "Positive" : score <= 0.4 ? "Negative" : "Neutral";
    return `- [${label}] "${f?.comment ?? ""}" (sentiment: ${Math.round(score * 100)}%)`;
  }).join("\n");

  const weakSummary = weakMetrics
    .map((m) => `- ${m.label} (${m.key}): ${m.score}/100`)
    .join("\n");

  const prompt = `
You are an expert HR analytics coach. A manager named ${manager?.name ?? "Unknown"} (${manager?.department ?? "Unknown"} dept, ${manager?.experienceYears ?? 0} yrs experience) has an effectiveness score of ${finalScore ?? 0}/100.

The following metrics are WEAK (below 60/100):
${weakSummary}

Recent team feedback:
${recentFeedback || "No feedback available."}

For EACH weak metric above, generate a structured improvement plan. Return ONLY a valid JSON array where each element has:
{
  "metricKey": "<exact key from the list above>",
  "metricLabel": "<human-readable label>",
  "currentScore": <number>,
  "severity": "<critical if score < 40, warning if 40-59>",
  "predictedReasons": ["<reason1>", "<reason2>", "<reason3>"],
  "touchpoints": [
    { "week": 1, "action": "<specific actionable step>", "impact": "high|medium|low" },
    { "week": 2, "action": "<next step>", "impact": "high|medium|low" },
    { "week": 4, "action": "<follow-up step>", "impact": "high|medium|low" }
  ],
  "suggestion": "<1-2 sentence overarching recommendation>",
  "milestoneTarget": <target score between 65-85>,
  "estimatedWeeks": <number between 4-12>
}

STRICT RULES:
- Return ONLY the JSON array, no markdown, no explanation.
- Each weak metric MUST have at least 2 predictedReasons and 3 touchpoints.
- touchpoint weeks should be sequential and realistic.
- Base your analysis on the actual feedback comments and metric context.
`.trim();

  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "google/gemma-3-12b-it:free",
    "qwen/qwen3-coder:free",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🚀 Improvement Roadmap AI model:", model);

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed && parsed.length > 0) {
        // Validate and enrich each item
        return {
          roadmap: parsed.map((item) => ({
            metricKey: item.metricKey || "unknown",
            metricLabel: item.metricLabel || item.metricKey || "Unknown Metric",
            currentScore: Number(item.currentScore) || 0,
            severity: item.severity === "critical" ? "critical" : "warning",
            predictedReasons: Array.isArray(item.predictedReasons) ? item.predictedReasons.slice(0, 5) : [],
            touchpoints: Array.isArray(item.touchpoints)
              ? item.touchpoints.slice(0, 6).map((tp) => ({
                week: Number(tp.week) || 1,
                action: tp.action || "",
                impact: ["high", "medium", "low"].includes(tp.impact) ? tp.impact : "medium",
              }))
              : [],
            suggestion: item.suggestion || "",
            milestoneTarget: Math.min(100, Math.max(item.currentScore + 10, Number(item.milestoneTarget) || 70)),
            estimatedWeeks: Math.max(2, Math.min(16, Number(item.estimatedWeeks) || 6)),
          })),
        };
      }

      console.warn(`⚠️ Model ${model} returned unparseable roadmap response`);
    } catch (err) {
      console.error(`❌ Roadmap Model ${model} failed:`, err.message);
      lastError = err?.response?.data?.error?.message || err?.message || String(err);
    }
  }

  const msg = lastError ? `AI roadmap failed: ${lastError}` : "AI roadmap failed on all models";
  throw new Error(msg);
}

module.exports = { generateAISuggestions, generateEmployeeSuggestions, analyzeSentiment, generateImprovementRoadmap };
