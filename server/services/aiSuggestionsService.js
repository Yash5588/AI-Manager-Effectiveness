const OpenAI = require("openai").default;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "missing-openrouter-api-key";

// OpenRouter client
const openRouterClient = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Manager Effectiveness",
  },
});

// Rate-limit guard
let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

const JSON_SYSTEM_INSTRUCTION = "You are a JSON-only API. Output ONLY a valid JSON array. No markdown, no code fences, no explanations, no reasoning — just the raw JSON array.";

// Gemma models don't support system/developer messages — merge into user prompt
function buildMessages(model, prompt) {
  if (model.includes("gemma")) {
    return [{ role: "user", content: `${JSON_SYSTEM_INSTRUCTION}\n\n${prompt}` }];
  }
  return [
    { role: "system", content: JSON_SYSTEM_INSTRUCTION },
    { role: "user", content: prompt },
  ];
}

// Parse JSON array from AI response
function safeParseJSONArray(text) {
  try {
    if (!text) return null;

    const cleaned = text
      // Strip <think>...</think> reasoning blocks (deepseek-r1)
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      // Strip any other XML-like wrapper tags
      .replace(/<\/?output>/gi, "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");

    if (start === -1) return null;

    // If we found both brackets, try normal parse first
    if (end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        // Fall through to truncation repair
      }
    }

    // Truncation repair: JSON was cut off mid-way due to max_tokens
    let fragment = cleaned.slice(start);

    // Remove any trailing incomplete key-value pair (e.g., `"metricKey": "tea`)
    fragment = fragment.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, "");

    // Close any open structures
    const openBraces = (fragment.match(/{/g) || []).length;
    const closeBraces = (fragment.match(/}/g) || []).length;
    const openBrackets = (fragment.match(/\[/g) || []).length;
    const closeBrackets = (fragment.match(/]/g) || []).length;

    // Remove trailing comma before we close
    fragment = fragment.replace(/,\s*$/, "");

    // Close remaining open braces and brackets
    for (let i = 0; i < openBraces - closeBraces; i++) fragment += "}";
    for (let i = 0; i < openBrackets - closeBrackets; i++) fragment += "]";

    const repaired = JSON.parse(fragment);
    if (Array.isArray(repaired) && repaired.length > 0) {
      console.log(`🔧 Repaired truncated JSON (recovered ${repaired.length} items)`);
      return repaired;
    }
    return null;
  } catch (err) {
    console.warn("⚠️ safeParseJSONArray failed:", err.message);
    console.warn("⚠️ Raw AI text (first 500 chars):", (text || "").slice(0, 500));
    return null;
  }
}

function safeParseJSONObject(text) {
  try {
    if (!text) return null;

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<\/?output>/gi, "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1) return null;

    if (end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch {
        // Fall through to truncation repair
      }
    }

    let fragment = cleaned.slice(start);
    fragment = fragment.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, "");
    fragment = fragment.replace(/,\s*([}\]])/g, "$1");

    const openBraces = (fragment.match(/{/g) || []).length;
    const closeBraces = (fragment.match(/}/g) || []).length;
    const openBrackets = (fragment.match(/\[/g) || []).length;
    const closeBrackets = (fragment.match(/]/g) || []).length;

    for (let i = 0; i < openBraces - closeBraces; i++) fragment += "}";
    for (let i = 0; i < openBrackets - closeBrackets; i++) fragment += "]";

    const repaired = JSON.parse(fragment);
    return repaired && typeof repaired === "object" && !Array.isArray(repaired) ? repaired : null;
  } catch (err) {
    console.warn("⚠️ safeParseJSONObject failed:", err.message);
    console.warn("⚠️ Raw AI text (first 500 chars):", (text || "").slice(0, 500));
    return null;
  }
}

function truncateText(value = "", maxLength = 120) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function formatMetricNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
}

function buildFallbackAISuggestions(payload = {}, reason = "") {
  const finalScore = Number(payload.finalScore) || 0;
  const breakdown = payload.breakdown || {};
  const extendedMetrics = payload.extendedMetrics || {};
  const feedbackScore = Math.round((breakdown.avgFeedbackScore ?? 0.5) * 100);
  const employeeScore = Math.round((breakdown.avgEmployeeScore ?? 0.5) * 100);
  const metricsScore = Math.round((breakdown.avgMetricScore ?? 0.5) * 100);
  const basePredictedScore = Math.min(100, Math.max(finalScore + 4, finalScore + 1));

  const candidates = [
    {
      category: "communication",
      title: "Close feedback loops faster",
      description: `Review recent feedback themes and respond with one clear action for the team this week${reason ? " while AI recommendations are temporarily unavailable" : ""}.`,
      priority: feedbackScore < 65 ? "high" : "medium",
      predictedScore: basePredictedScore,
    },
    {
      category: "growth",
      title: "Strengthen development planning",
      description: `Create or refresh IDP goals for team members, prioritizing employees without active development momentum.`,
      priority: (extendedMetrics.IDP ?? 0) < 3 ? "high" : "medium",
      predictedScore: Math.min(100, basePredictedScore + 2),
    },
    {
      category: "leadership",
      title: "Tighten goal execution rhythm",
      description: `Use a weekly check-in to review blockers, goal progress, and ownership so execution signals improve before the next score refresh.`,
      priority: metricsScore < 70 ? "high" : "medium",
      predictedScore: Math.min(100, basePredictedScore + 3),
    },
    {
      category: "culture",
      title: "Increase recognition moments",
      description: `Recognize concrete wins in team channels and 1:1s to improve engagement and sentiment signals.`,
      priority: employeeScore < 70 ? "medium" : "low",
      predictedScore: Math.min(100, basePredictedScore + 4),
    },
  ];

  return candidates;
}

function buildFallbackPeerComparison(payload = {}, reason = "") {
  const current = payload.currentManager || {};
  const peer = payload.peerManager || {};
  const currentScore = Number(current.finalScore) || 0;
  const peerScore = Number(peer.finalScore) || currentScore;
  const gap = Math.max(0, Math.round((peerScore - currentScore) * 10) / 10);
  const currentExt = current.extendedMetrics || {};
  const peerExt = peer.extendedMetrics || {};

  const metricRows = [
    {
      key: "goalCompletionRate",
      label: "Goal Execution",
      action: "Run a weekly goal review with owners, blockers, and next milestones.",
    },
    {
      key: "employeeEngagementScore",
      label: "Engagement",
      action: "Add a recurring recognition and listening ritual to surface team concerns earlier.",
    },
    {
      key: "teamRetentionRate",
      label: "Retention",
      action: "Use 1:1s to identify flight-risk signals and agree on retention actions.",
    },
    {
      key: "subordinate360Rating",
      label: "Manager Feedback",
      action: "Ask for targeted feedback on communication, availability, and decision clarity.",
    },
    {
      key: "IDP",
      label: "Development Planning",
      action: "Refresh IDPs with measurable next steps and dates for each direct report.",
    },
  ];

  const peerAdvantages = metricRows
    .map((row) => {
      const currentValue = Number(currentExt[row.key] ?? current.breakdown?.[row.key] ?? 0);
      const peerValue = Number(peerExt[row.key] ?? peer.breakdown?.[row.key] ?? 0);
      return {
        ...row,
        delta: peerValue - currentValue,
      };
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map((row) => ({
      area: row.label,
      peerStrength: `The benchmark peer shows stronger signals in ${row.label.toLowerCase()} based on the available manager metrics.`,
      yourGap: `This is an opportunity area for your team compared with the peer benchmark.`,
      actionItem: row.action,
      impact: row.delta > 10 ? "high" : row.delta > 3 ? "medium" : "low",
    }));

  return {
    peerAdvantages,
    scoreSummary: {
      yourScore: currentScore,
      peerScore,
      gap,
      topDifferentiators: peerAdvantages.map((item) => item.area),
    },
    overallInsight: reason
      ? "AI peer comparison is temporarily unavailable, so this fallback uses formula-based manager metrics to highlight the most likely improvement areas."
      : "This comparison uses available manager metrics to highlight the most likely improvement areas.",
  };
}

async function generateAISuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    return buildFallbackAISuggestions(payload, "OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    const wait = MIN_DELAY_MS - (now - lastCallTime);
    console.log(`AI Throttle: Waiting ${wait}ms...`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastCallTime = Date.now();

  const {
    manager,
    employees = [],
    feedbacks = [],
    metrics = [],
    extendedMetrics = {},
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
  const fallbackSuggestions = buildFallbackAISuggestions(payload);

  const employeesSummary =
    employees.length > 0
      ? employees
        .slice(0, 4)
        .map(
          (e) =>
            `- ${e?.name ?? "N/A"} (${e?.role ?? "N/A"}): rating ${e?.performanceRating ?? "?"}/5`
        )
        .concat(
          employees.length > 4
            ? [`- Additional employees omitted for brevity: ${employees.length - 4}`]
            : []
        )
        .join("\n")
      : "No employees on record.";

  const feedbacksSummary =
    feedbacks.length > 0
      ? feedbacks
        .slice(0, 3)
        .map((f) => {
          let line = `- "${truncateText(f?.comment, 90)}" (sentiment: ${Math.round(
            (f?.sentimentScore ?? 0) * 100
          )}%, composite: ${Math.round((f?.compositeFeedbackScore ?? f?.sentimentScore ?? 0) * 100)}%)`;
          if (f?.npsScore != null) line += ` [NPS: ${f.npsScore}/10]`;
          if (f?.pulseMood) line += ` [Mood: ${f.pulseMood}]`;
          if (f?.feedbackCategory) line += ` [Category: ${f.feedbackCategory}]`;
          return line;
        })
        .join("\n")
      : "No feedback on record.";

  const metricsSummary =
    metrics.length > 0
      ? metrics
        .slice(0, 4)
        .map((m) => `- ${m?.metricName ?? "N/A"}: ${m?.value ?? "?"}`)
        .join("\n")
      : "No metrics on record.";

  const extendedSummary = extendedMetrics
    ? [
      `- Team Retention: ${extendedMetrics.teamRetentionRate ?? "N/A"}%`,
      `- Goal Completion: ${extendedMetrics.goalCompletionRate ?? "N/A"}%`,
      `- Promotion Rate: ${extendedMetrics.employeePromotionRate ?? "N/A"}%`,
      `- 360 Feedback Rating: ${extendedMetrics.subordinate360Rating ?? "N/A"}/100`,
      `- Engagement Score: ${extendedMetrics.employeeEngagementScore ?? "N/A"}/100`,
      `- Development Plans (IDP): ${extendedMetrics.IDP ?? "N/A"} active plans`,
    ].join("\n")
    : "No extended metrics on record.";

  const prompt = `
You are a management coach.

Return ONLY a valid JSON array with exactly 3 objects:
[
  {
    "category": "communication" | "leadership" | "delegation" | "growth" | "culture",
    "title": "short title",
    "description": "short action with reason",
    "priority": "high" | "medium" | "low",
    "predictedScore": <integer greater than ${finalScore ?? 0}>
  }
]

Rules:
- Use only the data below.
- Keep title under 6 words.
- Keep description under 18 words.
- Keep predictedScore within 1-6 points above ${finalScore ?? 0}.
- No markdown. No extra text.

Manager: ${manager?.name ?? "Unknown"} | ${manager?.department ?? "Unknown"} | ${manager?.experienceYears ?? 0} years
Overall Score: ${finalScore ?? 0}/100 (${category ?? "Unknown"})
Core Signals: employee ${employeePct}, feedback ${feedbackPct}, metrics ${metricsPct}

Team Sample:
${employeesSummary}

Recent Feedback Themes:
${feedbacksSummary}

Key Metrics:
${metricsSummary}

Extended Metrics:
${extendedSummary}
`.trim();

  const models = [
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-chat",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 AI model:", model);

      const isFree = model.includes(":free");
      const completion =
        await openRouterClient.chat.completions.create({
          model,
          messages: buildMessages(model, prompt),
          temperature: 0.2,
          max_tokens: isFree ? 220 : 96,
        });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed && parsed.length > 0) {
        const normalizedSuggestions = parsed.slice(0, 3).map((s, index) => {
          const fallback = fallbackSuggestions[index] || fallbackSuggestions[0];
          const current = finalScore ?? 0;
          let predicted = Number(s.predictedScore);

          if (isNaN(predicted) || predicted <= current) {
            predicted = Math.min(100, Number(fallback?.predictedScore) || current + 2);
          }

          return {
            category: s?.category || fallback?.category || "leadership",
            title: truncateText(s?.title || fallback?.title || "Improve team rhythm", 48),
            description: truncateText(s?.description || fallback?.description || "Focus on one clear improvement area this cycle.", 140),
            priority: ["high", "medium", "low"].includes(s?.priority) ? s.priority : (fallback?.priority || "medium"),
            predictedScore: predicted,
          };
        });

        while (normalizedSuggestions.length < 3 && fallbackSuggestions[normalizedSuggestions.length]) {
          normalizedSuggestions.push(fallbackSuggestions[normalizedSuggestions.length]);
        }

        return normalizedSuggestions;
      }
    } catch (err) {
      console.error(`❌ Model ${model} failed:`, err.message);
      console.error(`   Status:`, err?.status || err?.response?.status || 'N/A');
      console.error(`   Error type:`, err?.type || err?.error?.type || 'N/A');
      if (err?.error) {
        console.error(`   Error details:`, JSON.stringify(err.error));
      }
      if (err.response?.data) {
        console.error("   Response data:", JSON.stringify(err.response.data));
      }
      lastError =
        err?.error?.message ||
        err?.response?.data?.error?.message ||
        err?.message ||
        String(err);
      console.warn(`⚠️ Model failed: ${model}`, lastError);
    }
  }

  const msg = lastError
    ? `AI failed: ${lastError}`
    : "AI failed on all models";
  console.warn(`⚠️ ${msg}. Returning fallback suggestions.`);
  return buildFallbackAISuggestions(payload, msg);
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
- Promotion Rate: ${teamMetrics.promotionRate ?? 0}%
- Retention Rate: ${teamMetrics.teamRetentionRate ?? 0}%
- 360 Feedback Rating: ${teamMetrics.subordinate360Rating ?? 0}/100
- Engagement Score: ${teamMetrics.engagementScore ?? 0}%
- Development Plans (IDP): ${teamMetrics.totalDevGoals ?? 0} total (avg ${teamMetrics.avgDevGoalAssignment ?? 0}/employee)
- Dev Goal Status: ${teamMetrics.devGoalStatus ?? "Unknown"}

Employee Talent Profiles:
${employeeDetails}
`.trim();

  const models = [
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 Employee coaching AI model:", model);

      const isFree = model.includes(":free");
      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: buildMessages(model, prompt),
        temperature: 0.3,
        max_tokens: isFree ? 1200 : 600,
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
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
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

  const breakdownLabels = {
    employeePerformance: "Performance Score",
    feedbackSentiment: "Sentiment Score",
    kpiMetrics: "KPI Metrics Score",
    teamRetention: "Team Retention",
    goalCompletion: "Goal Completion",
    employeePromotion: "Promotion Rate",
    subordinate360: "360 Feedback Rating",
    engagement: "Engagement Score",
    idpScore: "Development Plans (IDP)",
  };

  const extendedLabels = {
    teamRetentionRate: "Team Retention",
    goalCompletionRate: "Goal Completion",
    employeePromotionRate: "Promotion Rate",
    subordinate360Rating: "360 Feedback Rating",
    employeeEngagementScore: "Engagement Score",
    IDP: "Development Plans (IDP)",
  };

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
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-r1",
    "deepseek/deepseek-chat",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🚀 Improvement Roadmap AI model:", model);

      const isFree = model.includes(":free");
      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: buildMessages(model, prompt),
        temperature: 0.3,
        max_tokens: isFree ? 2000 : 800,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed && parsed.length > 0) {
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
      const providerError = err?.response?.data?.error?.message || err?.message || String(err);
      lastError = providerError === "401 User not found."
        ? "OpenRouter authentication failed for roadmap generation"
        : providerError;
    }
  }

  const msg = lastError ? `AI roadmap failed: ${lastError}` : "AI roadmap failed on all models";
  throw new Error(msg);
}

// ────────────── Peer Comparison Analysis ──────────────
async function generatePeerComparison(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    return buildFallbackPeerComparison(payload, "OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
  }
  lastCallTime = Date.now();

  const { currentManager, peerManager } = payload;
  const fallbackComparison = buildFallbackPeerComparison(payload);
  const peerMetricRows = [
    { key: "goalCompletionRate", label: "Goal Execution" },
    { key: "employeeEngagementScore", label: "Engagement" },
    { key: "teamRetentionRate", label: "Retention" },
    { key: "subordinate360Rating", label: "Manager Feedback" },
    { key: "IDP", label: "Development Planning" },
  ];
  const metricGapSummary = peerMetricRows
    .map((row) => {
      const yourValue = formatMetricNumber(currentManager?.extendedMetrics?.[row.key] ?? currentManager?.breakdown?.[row.key]);
      const peerValue = formatMetricNumber(peerManager?.extendedMetrics?.[row.key] ?? peerManager?.breakdown?.[row.key]);
      if (yourValue == null || peerValue == null) return null;
      return {
        label: row.label,
        yourValue,
        peerValue,
        delta: Math.round((peerValue - yourValue) * 10) / 10,
      };
    })
    .filter((row) => row && row.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);
  const metricGapText = metricGapSummary.length > 0
    ? metricGapSummary
      .map((row) => `- ${row.label}: you ${row.yourValue}, peer ${row.peerValue}, gap ${row.delta}`)
      .join("\n")
    : "- No reliable positive metric gaps found";
  const scoreGap = Math.max(0, Math.round(((peerManager?.finalScore ?? 0) - (currentManager?.finalScore ?? 0)) * 10) / 10);

  const prompt = `
You are an HR analytics coach.

Return ONLY a valid JSON object:
{
  "peerAdvantages": [
    {
      "area": "<metric label from the list below>",
      "peerStrength": "<short phrase>",
      "yourGap": "<short phrase>",
      "actionItem": "<short action>",
      "impact": "high" | "medium" | "low"
    }
  ],
  "scoreSummary": {
    "yourScore": ${currentManager?.finalScore ?? 0},
    "peerScore": ${peerManager?.finalScore ?? 0},
    "gap": ${scoreGap},
    "topDifferentiators": ["<metric1>", "<metric2>"]
  },
  "overallInsight": "<one short sentence>"
}

Rules:
- Exactly 2 peerAdvantages.
- Use only the metric gaps below.
- "area" must match a metric label below.
- Keep peerStrength, yourGap, and actionItem under 12 words each.
- Keep overallInsight under 20 words.
- No markdown. No extra text.

Current Manager: ${currentManager?.department ?? "Unknown"} | ${currentManager?.experienceYears ?? 0} years | score ${currentManager?.finalScore ?? 0}
Higher-Ranked Peer: ${peerManager?.department ?? "Unknown"} | ${peerManager?.experienceYears ?? 0} years | score ${peerManager?.finalScore ?? 0}

Largest Metric Gaps:
${metricGapText}
`.trim();

  const models = [
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-chat",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🔍 Peer Comparison AI model:", model);

      const isFree = model.includes(":free");
      const systemMsg = "You are a JSON-only API. Output ONLY a valid JSON object. No markdown, no code fences, no explanations, no reasoning — just the raw JSON object.";

      const messages = model.includes("gemma")
        ? [{ role: "user", content: `${systemMsg}\n\n${prompt}` }]
        : [{ role: "system", content: systemMsg }, { role: "user", content: prompt }];

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        max_tokens: isFree ? 180 : 96,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONObject(content);
      if (parsed && Array.isArray(parsed.peerAdvantages) && parsed.peerAdvantages.length > 0) {
        const yourScore = Number(parsed?.scoreSummary?.yourScore);
        const peerScore = Number(parsed?.scoreSummary?.peerScore);
        const gap = Number(parsed?.scoreSummary?.gap);
        const peerAdvantages = parsed.peerAdvantages.slice(0, 2).map((item, index) => {
          const fallback = fallbackComparison.peerAdvantages[index] || fallbackComparison.peerAdvantages[0];
          return {
            area: item?.area || fallback?.area || "Improvement Area",
            peerStrength: truncateText(item?.peerStrength || fallback?.peerStrength || "Peer shows stronger operating signals.", 80),
            yourGap: truncateText(item?.yourGap || fallback?.yourGap || "This area trails the benchmark.", 80),
            actionItem: truncateText(item?.actionItem || fallback?.actionItem || "Run a focused improvement cadence.", 90),
            impact: ["high", "medium", "low"].includes(item?.impact) ? item.impact : (fallback?.impact || "medium"),
          };
        });

        while (peerAdvantages.length < 2 && fallbackComparison.peerAdvantages[peerAdvantages.length]) {
          peerAdvantages.push(fallbackComparison.peerAdvantages[peerAdvantages.length]);
        }

        return {
          peerAdvantages,
          scoreSummary: {
            yourScore: Number.isFinite(yourScore) ? yourScore : fallbackComparison.scoreSummary.yourScore,
            peerScore: Number.isFinite(peerScore) ? peerScore : fallbackComparison.scoreSummary.peerScore,
            gap: Number.isFinite(gap) ? gap : fallbackComparison.scoreSummary.gap,
            topDifferentiators:
              Array.isArray(parsed?.scoreSummary?.topDifferentiators) && parsed.scoreSummary.topDifferentiators.length > 0
                ? parsed.scoreSummary.topDifferentiators.slice(0, 3)
                : fallbackComparison.scoreSummary.topDifferentiators,
          },
          overallInsight: truncateText(parsed?.overallInsight || fallbackComparison.overallInsight, 140),
        };
      }
    } catch (err) {
      console.error(`❌ Peer Comparison Model ${model} failed:`, err.message);
      lastError = err?.error?.message || err?.message || String(err);
    }
  }

  const msg = lastError ? `AI peer comparison failed: ${lastError}` : "AI peer comparison failed on all models";
  console.warn(`⚠️ ${msg}. Returning fallback peer comparison.`);
  return buildFallbackPeerComparison(payload, msg);
}

// ────────────── Teams Transcript Sentiment Analysis ──────────────
async function analyzeTeamsTranscript(prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
  }
  lastCallTime = Date.now();

  const models = [
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-chat",
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("📋 Teams Transcript AI model:", model);

      const isFree = model.includes(":free");
      const systemMsg = "You are a JSON-only API. Output ONLY a valid JSON object. No markdown, no code fences, no explanations.";

      const messages = model.includes("gemma")
        ? [{ role: "user", content: `${systemMsg}\n\n${prompt}` }]
        : [{ role: "system", content: systemMsg }, { role: "user", content: prompt }];

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: isFree ? 800 : 500,
      });

      const content = completion?.choices?.[0]?.message?.content;
      if (content) {
        const cleaned = content
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
          if (parsed && typeof parsed.overallSentiment === "number") {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error(`❌ Teams Transcript Model ${model} failed:`, err.message);
      lastError = err?.error?.message || err?.message || String(err);
    }
  }

  throw new Error(lastError || "Teams transcript analysis failed on all models");
}

module.exports = { generateAISuggestions, generateEmployeeSuggestions, analyzeSentiment, generateImprovementRoadmap, generatePeerComparison, analyzeTeamsTranscript };
