const OpenAI = require("openai").default;

/* ───────────────────────────────────────────────
   Create ONE OpenRouter client (GLOBAL)
   ─────────────────────────────────────────────── */
const openRouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "AI Manager Effectiveness",
  },
});

/* ───────────────────────────────────────────────
   Rate-limit guard (prevents Cloudflare ban)
   ─────────────────────────────────────────────── */
let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

/* ───────────────────────────────────────────────
   Safe JSON array parser
   ─────────────────────────────────────────────── */
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

/* ───────────────────────────────────────────────
   Main AI suggestion generator
   ─────────────────────────────────────────────── */
async function generateAISuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  // ⏱ Rate limit protection
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
        .map(
          (f) =>
            `- "Anonymous Feedback": "${f?.comment ?? ""}" (${Math.round(
              (f?.sentimentScore ?? 0) * 100
            )}%)`
        )
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

  /* ───────────────────────────────────────────────
     Model fallback logic (IMPORTANT)
     ─────────────────────────────────────────────── */
  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "qwen/qwen-2.5-72b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free"
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
        // 🛡️ Post-processing: Ensure strictly increasing scores
        return parsed.map((s) => {
          const current = finalScore ?? 0;
          let predicted = Number(s.predictedScore);

          // If AI hallucinated a lower score or invalid number, fix it
          if (isNaN(predicted) || predicted <= current) {
            // Add a realistic boost if the AI failed to provide a valid one
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

/* ───────────────────────────────────────────────
  Per-Employee Suggestion Generator
   ─────────────────────────────────────────────── */
async function generateEmployeeSuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  // ⏱ Rate limit protection
  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
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
    throw new Error("Manager data is required for employee suggestions");
  }

  const employeePct = Math.round((breakdown.avgEmployeeScore ?? 0.5) * 100);
  const feedbackPct = Math.round((breakdown.avgFeedbackScore ?? 0.5) * 100);
  const metricsPct = Math.round((breakdown.avgMetricScore ?? 0.5) * 100);

  const metricsSummary =
    metrics.length > 0
      ? metrics.map((m) => `- ${m?.metricName ?? "N/A"}: ${m?.value ?? "?"}`).join("\n")
      : "No metrics on record.";

  // Build per-employee detail blocks
  const employeeDetails = employees
    .map((emp) => {
      const empFeedbacks = feedbacks.filter(
        (f) => f.fromEmployee === emp.name
      );
      const feedbackText =
        empFeedbacks.length > 0
          ? empFeedbacks
            .map(
              (f) =>
                `    - "${f?.comment ?? ""}" (sentiment: ${Math.round(
                  (f?.sentimentScore ?? 0) * 100
                )}%)`
            )
            .join("\n")
          : "    - No feedback given.";

      return `  Employee: ${emp?.name ?? "N/A"}
  Role: ${emp?.role ?? "N/A"}
  Performance Rating: ${emp?.performanceRating ?? "?"}/5
  Their Feedback about the manager:
${feedbackText}`;
    })
    .join("\n\n");

  const prompt = `
You are an expert management coach.

A manager wants to give personalized improvement suggestions to each of their employees. 
For EACH employee listed below, generate 2-3 actionable suggestions the manager should give that employee to help improve the MANAGER'S overall effectiveness score.

The suggestions should account for:
- The employee's current performance rating
- The feedback they gave about the manager (to address any concerns)
- The team's overall metrics
- What actions by this employee would help improve the manager's effectiveness

Also predict what the manager's NEW overall effectiveness score (out of 100) would be if that employee follows all the suggestions. The current manager effectiveness score is ${finalScore ?? 0}/100.

STRICT RULES:
- Output ONLY a valid JSON array of objects.
- Each object represents ONE employee and must have:
  - "employeeName": string (employee's name)
  - "employeeRole": string (employee's role)
  - "currentRating": number (their current performance rating out of 5)
  - "suggestions": array of objects, each with:
    - "title": string (short actionable title)
    - "description": string (1-2 sentences explaining what the employee should do)
    - "focus": one of ["performance", "communication", "collaboration", "skills", "initiative"]
  - "predictedManagerScore": number (predicted manager effectiveness score out of 100 AFTER this employee follows all suggestions. MUST be strictly GREATER than ${finalScore ?? 0} and at most 100)
  - "rationale": string (1 sentence explaining why these suggestions would boost the manager's score)
- No markdown, no explanations, ONLY the JSON array.

Manager: ${manager?.name ?? "Unknown"}
Department: ${manager?.department ?? "Unknown"}
Experience: ${manager?.experienceYears ?? 0} years
Current Score: ${finalScore ?? 0}/100 (${category ?? "Unknown"})

Score Breakdown:
- Employee Performance: ${employeePct}%
- Feedback Sentiment: ${feedbackPct}%
- Metrics Score: ${metricsPct}%

Team Metrics:
${metricsSummary}

Employee Details:
${employeeDetails}
`.trim();

  /* ─── Model fallback logic ──── */
  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "qwen/qwen-2.5-72b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free"
  ];

  let lastError = null;
  for (const model of models) {
    try {
      console.log("🧠 Employee suggestions AI model:", model);

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = completion?.choices?.[0]?.message?.content;
      const parsed = safeParseJSONArray(content);

      if (parsed) {
        // 🛡️ Post-processing: ensure valid predicted scores
        return parsed.map((emp) => {
          const current = finalScore ?? 0;
          let predicted = Number(emp.predictedManagerScore);

          if (isNaN(predicted) || predicted <= current) {
            predicted = Math.min(
              100,
              current + Math.floor(Math.random() * 6) + 3
            );
          }

          return {
            ...emp,
            predictedManagerScore: predicted,
          };
        });
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

/* ───────────────────────────────────────────────
   Sentiment Analysis for Feedback
   ─────────────────────────────────────────────── */
async function analyzeSentiment(comment) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  // ⏱ Rate limit protection
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
    "qwen/qwen-2.5-72b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-2.0-flash-exp:free"
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

        // Try to parse JSON object
        const jsonStart = cleaned.indexOf("{");
        const jsonEnd = cleaned.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
          const score = Number(parsed.sentimentScore);
          if (!isNaN(score) && score >= 0 && score <= 1) {
            return Math.round(score * 100) / 100;
          }
        }

        // Fallback: try extracting a number directly
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

  // If all models fail, return a neutral score
  console.warn("⚠️ All sentiment models failed, defaulting to 0.5");
  return 0.5;
}

module.exports = { generateAISuggestions, generateEmployeeSuggestions, analyzeSentiment };
