const OpenAI = require("openai").default;

/**
 * Explainable AI: Generate dynamic, data-driven improvement suggestions
 * using DeepSeek R1 via OpenRouter.
 */
async function generateAISuggestions(payload) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const {
    manager,
    employees,
    feedbacks,
    metrics,
    breakdown,
    finalScore,
    category,
    counts,
  } = payload;

  const employeePct = Math.round(breakdown.avgEmployeeScore * 100);
  const feedbackPct = Math.round(breakdown.avgFeedbackScore * 100);
  const metricsPct = Math.round(breakdown.avgMetricScore * 100);

  const employeesSummary =
    employees.length > 0
      ? employees
          .map(
            (e) =>
              `- ${e.name} (${e.role}): performance rating ${e.performanceRating}/5`
          )
          .join("\n")
      : "No employees on record.";

  const feedbacksSummary =
    feedbacks.length > 0
      ? feedbacks
          .map(
            (f) =>
              `- From ${f.fromEmployee}: "${f.comment}" (sentiment: ${(
                f.sentimentScore * 100
              ).toFixed(0)}%)`
          )
          .join("\n")
      : "No feedback on record.";

  const metricsSummary =
    metrics.length > 0
      ? metrics.map((m) => `- ${m.metricName}: ${m.value}`).join("\n")
      : "No metrics on record.";

  const prompt = `You are an expert management coach. Analyze the following COMPLETE manager effectiveness data and generate 4-6 specific, actionable improvement suggestions.

## MANAGER PROFILE
- Name: ${manager.name}
- Department: ${manager.department}
- Experience: ${manager.experienceYears} years

## OVERALL PERFORMANCE
- Effectiveness Score: ${finalScore}/100
- Category: ${category}

## SCORE BREAKDOWN
- Employee Performance: ${employeePct}
- Feedback Sentiment: ${feedbackPct}
- Metrics Score: ${metricsPct}

## EMPLOYEES
${employeesSummary}

## FEEDBACK
${feedbacksSummary}

## METRICS
${metricsSummary}

## REQUIREMENTS
- 1–2 sentences per suggestion
- Reference real data
- Explain WHY it matters
- Prioritize weakest areas
- Return ONLY a JSON array of strings`;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Manager Effectiveness",
      },
    });

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-r1", // ✅ FIXED
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 900,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return null;

    return JSON.parse(content);
  } catch (error) {
    console.error("DeepSeek AI suggestions error:", error);
    throw error;
  }
}

module.exports = { generateAISuggestions };
