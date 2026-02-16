const OpenAI = require("openai").default;

/* ───────────────────────────────────────────────
   1️⃣ Create ONE OpenRouter client (GLOBAL)
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
   2️⃣ Rate-limit guard (prevents Cloudflare ban)
   ─────────────────────────────────────────────── */
let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

/* ───────────────────────────────────────────────
   3️⃣ Safe JSON array parser
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
   4️⃣ Main AI suggestion generator
   ─────────────────────────────────────────────── */
async function generateAISuggestions(payload) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  // ⏱ Rate limit protection
  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    throw new Error("AI requests too frequent – throttled");
  }
  lastCallTime = now;

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
            `- ${f?.fromEmployee ?? "Anonymous"}: "${f?.comment ?? ""}" (${Math.round(
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
  - "predictedScore": number (the predicted overall effectiveness score out of 100 after the manager implements this suggestion. The current score is ${finalScore ?? 0}. The predicted score must be higher than ${finalScore ?? 0} and at most 100.)
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
     5️⃣ Model fallback logic (IMPORTANT)
     ─────────────────────────────────────────────── */
  const models = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "meta-llama/llama-3.2-3b-instruct:free"
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

      if (parsed) return parsed;
    } catch (err) {
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

// -----------------------------------------------
// 6️⃣ Sentiment Analysis
// -----------------------------------------------
async function analyzeSentiment(text) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY missing, returning 0.5");
    return 0.5; // default to neutral
  }

  // Rate limit protection
  const now = Date.now();
  if (now - lastCallTime < MIN_DELAY_MS) {
    // Basic backoff for sentiment might be needed, or just proceed
    // For now we share the same throttle
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
  }
  lastCallTime = Date.now();

  const prompt = `
     Analyze the sentiment of the following feedback text.
     Respond with ONLY a number between 0 and 1 (inclusive), where 0 is negative, 0.5 is neutral, 1 is positive.
     No markdown. No extra text.

     Text: "${text}"
  `.trim();

  const models = [
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.2-3b-instruct:free"
  ];

  for (const model of models) {
    try {
      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Low temperature for consistent scoring
        max_tokens: 10,
      });

      const content = completion?.choices?.[0]?.message?.content?.trim();
      const score = parseFloat(content);

      if (!isNaN(score) && score >= 0 && score <= 1) {
        return score;
      }
    } catch (err) {
      console.warn(`Sentiment analysis failed on ${model}:`, err.message);
    }
  }

  return 0.5; // Fallback
}

module.exports = { generateAISuggestions, analyzeSentiment };
