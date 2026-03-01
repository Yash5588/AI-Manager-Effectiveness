const OpenAI = require("openai").default;

// OpenRouter client
const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Manager Effectiveness",
    },
});

// Rate-limit guard
let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

// Parse JSON object from AI response
function safeParseJSONObject(text) {
    try {
        if (!text) return null;

        const cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start === -1 || end === -1) return null;

        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

// Compute AI effectiveness score
async function computeAIScore(payload) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing");
    }

    // Rate limit
    const now = Date.now();
    if (now - lastCallTime < MIN_DELAY_MS) {
        const wait = MIN_DELAY_MS - (now - lastCallTime);
        console.log(`⏱ AI Score Throttle: Waiting ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
    }
    lastCallTime = Date.now();

    const {
        manager,
        employees = [],
        feedbacks = [],
        metrics = [],
        extendedMetrics = {},
        breakdown = {},
        formulaScore,
    } = payload;

    if (!manager) {
        throw new Error("Manager data is required for AI scoring");
    }

    // Build data summaries for prompt
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
                    let line = `- "${f?.fromEmployee ?? "Anonymous"}": "${f?.comment ?? ""}" (sentiment: ${Math.round(
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
                    if (f?.peerComparison) line += ` [vs Peers: ${f.peerComparison}]`;
                    if (f?.oneOnOneFrequency) line += ` [1:1s: ${f.oneOnOneFrequency}]`;
                    if (f?.feedbackCategory) line += ` [Category: ${f.feedbackCategory}]`;
                    if (f?.feedbackType) line += ` [Type: ${f.feedbackType}]`;
                    if (f?.urgency) line += ` [Urgency: ${f.urgency}]`;
                    return line;
                })
                .join("\n")
            : "No feedback on record.";

    const metricsSummary =
        metrics.length > 0
            ? metrics.map((m) => `- ${m?.metricName ?? "N/A"}: ${m?.value ?? "?"}/100`).join("\n")
            : "No metrics on record.";

    // Extended metrics summary
    const extMetrics = extendedMetrics || {};
    const extendedSummary = `
- Team Retention Rate: ${extMetrics.teamRetentionRate ?? "N/A"}/100
- Goal Completion Rate: ${extMetrics.goalCompletionRate ?? "N/A"}/100
- 1-on-1 Meeting Frequency: ${extMetrics.oneOnOneFrequency ?? "N/A"}/100
- Employee Growth Rate: ${extMetrics.employeeGrowthRate ?? "N/A"}/100
- Response Time Score: ${extMetrics.responseTimeScore ?? "N/A"}/100
- 360° Peer Review Score: ${extMetrics.peerReviewScore ?? "N/A"}/100
- Project Delivery Timeliness: ${extMetrics.projectDeliveryTimeliness ?? "N/A"}/100
- Employee Engagement Score: ${extMetrics.employeeEngagementScore ?? "N/A"}/100
- Training & Development Investment: ${extMetrics.trainingInvestment ?? "N/A"}/100`.trim();

    const prompt = `
You are an expert HR analytics engine. Compute an overall manager effectiveness score based on ALL the data below.

CRITICAL SCORING RULES:
1. The PRIMARY signals (~60% weight) are:
   - Employee Performance Score: ${employeePct}/100 (weight: ~20%)
   - Feedback Sentiment Score: ${feedbackPct}/100 (weight: ~20%)
   - KPI Metrics Score: ${metricsPct}/100 (weight: ~20%)

2. The SUPPLEMENTARY signals (~40% weight, ~4.4% each) are:
${extendedSummary}

3. Read the actual feedback comments carefully — they provide qualitative context that should influence the score beyond the raw numbers.

4. The formula-based score (weighted average of primary signals only) is ${formulaScore}/100. Your AI score may differ by up to ±15 points based on qualitative analysis.

STRICT OUTPUT FORMAT — Return ONLY a valid JSON object with these exact fields:
{
  "overallScore": <integer 0-100>,
  "breakdown": {
    "employeePerformance": <integer 0-100>,
    "feedbackSentiment": <integer 0-100>,
    "kpiMetrics": <integer 0-100>,
    "teamRetention": <integer 0-100>,
    "goalCompletion": <integer 0-100>,
    "oneOnOneQuality": <integer 0-100>,
    "employeeGrowth": <integer 0-100>,
    "responsiveness": <integer 0-100>,
    "peerReview": <integer 0-100>,
    "projectDelivery": <integer 0-100>,
    "engagement": <integer 0-100>,
    "trainingDevelopment": <integer 0-100>
  },
  "reasoning": "<2-3 sentence analysis explaining the score>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"]
}

- No markdown, no explanation outside the JSON, ONLY the JSON object.
- overallScore must be an integer between 0 and 100.
- All breakdown scores must be integers between 0 and 100.

Manager: ${manager?.name ?? "Unknown"}
Department: ${manager?.department ?? "Unknown"}
Experience: ${manager?.experienceYears ?? 0} years

Primary Scores:
- Employee Performance: ${employeePct}/100
- Feedback Sentiment: ${feedbackPct}/100
- KPI Metrics: ${metricsPct}/100

Employees:
${employeesSummary}

Feedback Comments:
${feedbacksSummary}

KPI Metrics:
${metricsSummary}

Supplementary Metrics:
${extendedSummary}
`.trim();

    // Model fallback chain
    const models = [
        "deepseek/deepseek-chat",
        "deepseek/deepseek-r1",
        "qwen/qwen-2.5-72b-instruct:free",
        "meta-llama/llama-3.2-3b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
    ];

    let lastError = null;
    for (const model of models) {
        try {
            console.log("🧠 AI Scoring model:", model);

            const completion = await openRouterClient.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0,       // ← Deterministic output
                top_p: 0.1,           // ← Further reduces randomness
                max_tokens: 800,
            });

            const content = completion?.choices?.[0]?.message?.content;
            const parsed = safeParseJSONObject(content);

            if (parsed && typeof parsed.overallScore === "number") {
                // Clamp and validate score
                const score = Math.max(0, Math.min(100, Math.round(parsed.overallScore)));

                // Validate breakdown values
                const breakdown = {};
                if (parsed.breakdown && typeof parsed.breakdown === "object") {
                    for (const [key, val] of Object.entries(parsed.breakdown)) {
                        breakdown[key] = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
                    }
                }

                return {
                    aiScore: score,
                    aiBreakdown: breakdown,
                    aiReasoning: parsed.reasoning || "No reasoning provided.",
                    aiStrengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
                    aiWeaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : [],
                };
            }

            console.warn(`⚠️ Model ${model} returned unparseable response`);
        } catch (err) {
            console.error(`❌ AI Scoring Model ${model} failed:`, err.message);
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
        ? `AI scoring failed: ${lastError}`
        : "AI scoring failed on all models";
    throw new Error(msg);
}

module.exports = { computeAIScore };
