const OpenAI = require("openai").default;

const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Manager Effectiveness - Attrition Prediction",
    },
});

let lastCallTime = 0;
const MIN_DELAY_MS = 1500;

function safeParseJSONObject(text) {
    try {
        if (!text) return null;
        const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        return null;
    }
}

// Predict attrition risk for a team
async function predictTeamAttrition(payload) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing");
    }

    const { manager, employees, feedbacks, metrics, extendedMetrics } = payload;

    // Build prompt
    const prompt = `
You are an expert HR Data Scientist and Talent Strategist. 
Analyze the following team data and predict:
1. Flight Risk (0-100): Probability of the employee leaving voluntarily soon.
2. Impact if Lost (0-100): The negative effect on the team/company if this employee leaves (based on performance, role, etc).

Manager Context:
- Name: ${manager.name}
- Department: ${manager.department}
- Overall Team Retention Rate: ${extendedMetrics.teamRetentionRate || "N/A"}%
- Team Engagement Score: ${extendedMetrics.employeeEngagementScore || "N/A"}%
- Growth Rate: ${extendedMetrics.employeeGrowthRate || "N/A"}%

Employee Data:
${employees.map(emp => {
        const empFeedbacks = feedbacks.filter(f => f.fromEmployee === emp.name || f.employeeId?.toString() === emp._id?.toString());
        const feedbackSummary = empFeedbacks.map(f => `"${f.comment}" (Sentiment: ${Math.round((f.sentimentScore || 0.5) * 100)}%)`).join("; ");

        return `- ${emp.name} (${emp.role}): 
      Rating: ${emp.performanceRating}/5
      Recent Feedback: ${feedbackSummary || "None"}
    `;
    }).join("\n")}

Additional Manager Metrics (apply to whole team environment):
- 1-on-1 Frequency: ${extendedMetrics.oneOnOneFrequency || "N/A"}/100
- Training Investment: ${extendedMetrics.trainingInvestment || "N/A"}/100
- Response Time: ${extendedMetrics.responseTimeScore || "N/A"}/100

STRICT OUTPUT FORMAT — Return ONLY a JSON object with this exact structure:
{
  "predictions": [
    {
      "employeeName": "Name",
      "flightRisk": <integer 0-100>,
      "impactScore": <integer 0-100>,
      "riskLevel": "High" | "Medium" | "Low",
      "impactLevel": "High" | "Medium" | "Low",
      "rationale": "One sentence explaining logic",
      "recommendation": "One specific retention or transition action"
    }
  ]
}

Scoring Guidelines:
- High performance (4-5) + Low sentiment (<0.4) = Very High Flight Risk.
- High performance (4-5) = High Impact if Lost.
- Low sentiment + Low engagement + Low growth = High Flight Risk.
- Low performance + Low sentiment = Medium Flight Risk but Low Impact if Lost.
`.trim();

    const models = [
        "deepseek/deepseek-chat",
        "google/gemini-2.0-flash-exp:free",
        "meta-llama/llama-3.2-3b-instruct:free",
    ];

    let lastError = null;
    for (const model of models) {
        try {
            // Rate limit
            const now = Date.now();
            if (now - lastCallTime < MIN_DELAY_MS) {
                await new Promise(r => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
            }
            lastCallTime = Date.now();

            console.log("🧠 Attrition Prediction model:", model);
            const completion = await openRouterClient.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 1500,
            });

            const content = completion?.choices?.[0]?.message?.content;
            const parsed = safeParseJSONObject(content);

            if (parsed && Array.isArray(parsed.predictions)) {
                return parsed.predictions;
            }
        } catch (err) {
            console.error(`❌ Attrition Model ${model} failed:`, err.message);
            lastError = err.message;
        }
    }

    throw new Error(lastError || "Attrition prediction failed");
}

module.exports = { predictTeamAttrition };
