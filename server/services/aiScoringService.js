const OpenAI = require("openai").default;

const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Manager Effectiveness",
    },
});

let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

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

/**
 * Generate qualitative AI insights (reasoning, strengths, weaknesses) for a manager.
 * The score is already computed by formula — this call only provides commentary.
 */
async function computeAIInsights(payload) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing");
    }

    const now = Date.now();
    if (now - lastCallTime < MIN_DELAY_MS) {
        const wait = MIN_DELAY_MS - (now - lastCallTime);
        console.log(`⏱ AI Insights Throttle: Waiting ${wait}ms...`);
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
        throw new Error("Manager data is required for AI insights");
    }

    const employeesSummary =
        employees.length > 0
            ? employees
                .map(
                    (e) =>
                        `- ${e?.name ?? "N/A"} (${e?.role ?? "N/A"}): rating ${e?.performanceRating ?? "?"}/5`
                )
                .join("\n")
            : "No employees on record.";

    // Cluster feedbacks by sentiment category for better LLM context
    function formatFeedbackLine(f) {
        const score = f?.sentimentScore ?? 0;
        const category = score >= 0.6 ? "Positive" : score <= 0.4 ? "Negative" : "Neutral";
        let line = `- [${category} | ${Math.round(score * 100)}%] "${f?.fromEmployee ?? "Anonymous"}": "${f?.comment ?? ""}" (composite: ${Math.round((f?.compositeFeedbackScore ?? score) * 100)}%)`;
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
    }

    let feedbacksSummary;
    if (feedbacks.length > 0) {
        const positive = feedbacks.filter(f => (f?.sentimentScore ?? 0) >= 0.6);
        const neutral = feedbacks.filter(f => { const s = f?.sentimentScore ?? 0; return s > 0.4 && s < 0.6; });
        const negative = feedbacks.filter(f => (f?.sentimentScore ?? 0) <= 0.4);

        const sections = [];
        if (positive.length > 0) sections.push(`POSITIVE (${positive.length}):\n${positive.map(formatFeedbackLine).join("\n")}`);
        if (neutral.length > 0) sections.push(`NEUTRAL (${neutral.length}):\n${neutral.map(formatFeedbackLine).join("\n")}`);
        if (negative.length > 0) sections.push(`NEGATIVE (${negative.length}):\n${negative.map(formatFeedbackLine).join("\n")}`);

        feedbacksSummary = sections.join("\n\n");
    } else {
        feedbacksSummary = "No feedback on record.";
    }

    const metricsSummary =
        metrics.length > 0
            ? metrics.map((m) => `- ${m?.metricName ?? "N/A"}: ${m?.value ?? "?"}/100`).join("\n")
            : "No metrics on record.";

    const ext = extendedMetrics || {};
    const extendedSummary = `
- Team Retention Rate: ${ext.teamRetentionRate ?? "N/A"}/100
- Goal Completion Rate: ${ext.goalCompletionRate ?? "N/A"}/100
- Employee Promotion Rate: ${ext.employeePromotionRate ?? "N/A"}/100
- 360° Subordinate Rating (MSF): ${ext.subordinate360Rating ?? "N/A"}/100
- Employee Engagement Score (Pulse): ${ext.employeeEngagementScore ?? "N/A"}/100
- IDP (Employees with Active Dev Goals): ${ext.IDP ?? "N/A"} employees`.trim();

    // Format breakdown for LLM context
    const breakdownSummary = Object.entries(breakdown)
        .map(([key, val]) => `- ${key}: ${val}/100`)
        .join("\n");

    const prompt = `
You are an expert HR analytics engine. A manager's effectiveness score has been computed using a weighted formula.
Your job is to provide QUALITATIVE INSIGHTS — reasoning, strengths, and weaknesses — based on the data below.
DO NOT compute or suggest a different score. The score is final.

FORMULA-COMPUTED SCORE: ${formulaScore}/100

DIMENSION BREAKDOWN:
${breakdownSummary}

Manager: ${manager?.name ?? "Unknown"}
Department: ${manager?.department ?? "Unknown"}
Experience: ${manager?.experienceYears ?? 0} years

Employees:
${employeesSummary}

Feedback Comments:
${feedbacksSummary}

KPI Metrics:
${metricsSummary}

Supplementary Metrics:
${extendedSummary}

STRICT OUTPUT FORMAT — Return ONLY a valid JSON object with these exact fields:
{
  "reasoning": "<2-3 sentence analysis explaining why the score makes sense given the data>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>", "<weakness3>"]
}

- No markdown, no explanation outside the JSON, ONLY the JSON object.
- Base your analysis on the actual feedback comments and metric values.
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
            console.log("🧠 AI Insights model:", model);

            const completion = await openRouterClient.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0,
                top_p: 0.1,
                max_tokens: 500,
            });

            const content = completion?.choices?.[0]?.message?.content;
            const parsed = safeParseJSONObject(content);

            if (parsed && typeof parsed.reasoning === "string") {
                return {
                    aiReasoning: parsed.reasoning || "No reasoning provided.",
                    aiStrengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
                    aiWeaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : [],
                };
            }

            console.warn(`⚠️ Model ${model} returned unparseable response`);
        } catch (err) {
            console.error(`❌ AI Insights Model ${model} failed:`, err.message);
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
        ? `AI insights failed: ${lastError}`
        : "AI insights failed on all models";
    throw new Error(msg);
}

module.exports = { computeAIInsights };
