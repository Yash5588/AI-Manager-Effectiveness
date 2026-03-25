const OpenAI = require("openai").default;

const openRouterClient = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Manager Effectiveness - Attrition Prediction",
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

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function computeFormulaFlightRisk(employee, empFeedbacks, extendedMetrics) {
    let totalWeight = 0;
    let weightedSum = 0;

    if (empFeedbacks.length > 0) {
        const avgSentiment = empFeedbacks.reduce((s, f) => s + (f.sentimentScore ?? 0.5), 0) / empFeedbacks.length;
        weightedSum += (1 - avgSentiment) * 0.20;
        totalWeight += 0.20;
    }

    if (empFeedbacks.length > 0) {
        const avgComposite = empFeedbacks.reduce((s, f) => s + (f.compositeFeedbackScore ?? f.sentimentScore ?? 0.5), 0) / empFeedbacks.length;
        weightedSum += (1 - avgComposite) * 0.15;
        totalWeight += 0.15;
    }

    const allRatings = empFeedbacks.filter(f => f.ratings);
    if (allRatings.length > 0) {
        const ratingAvgs = allRatings.map(f => {
            const vals = Object.values(f.ratings).filter(v => v != null && v > 0);
            return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 3;
        });
        const overallRatingAvg = ratingAvgs.reduce((s, v) => s + v, 0) / ratingAvgs.length;
        weightedSum += ((5 - overallRatingAvg) / 4) * 0.15;
        totalWeight += 0.15;
    }

    const npsValues = empFeedbacks.filter(f => f.npsScore != null).map(f => f.npsScore);
    if (npsValues.length > 0) {
        const avgNPS = npsValues.reduce((s, v) => s + v, 0) / npsValues.length;
        weightedSum += ((10 - avgNPS) / 10) * 0.10;
        totalWeight += 0.10;
    }

    const moodMap = { thriving: 0.0, happy: 0.2, neutral: 0.5, stressed: 0.8, struggling: 1.0 };
    const moods = empFeedbacks.filter(f => f.pulseMood).map(f => moodMap[f.pulseMood] ?? 0.5);
    if (moods.length > 0) {
        const avgMood = moods.reduce((s, v) => s + v, 0) / moods.length;
        weightedSum += avgMood * 0.10;
        totalWeight += 0.10;
    }

    const freqMap = { weekly: 0.0, biweekly: 0.2, monthly: 0.5, rarely: 0.8, never: 1.0, after_every_task: 0.0, same_day: 0.0, within_week: 0.2, within_month: 0.5 };
    const freqSignals = [];
    empFeedbacks.forEach(f => {
        if (f.oneOnOneFrequency) freqSignals.push(freqMap[f.oneOnOneFrequency] ?? 0.5);
        if (f.feedbackFrequency) freqSignals.push(freqMap[f.feedbackFrequency] ?? 0.5);
        if (f.concernResponseTime) freqSignals.push(freqMap[f.concernResponseTime] ?? 0.5);
    });
    if (freqSignals.length > 0) {
        const avgFreq = freqSignals.reduce((s, v) => s + v, 0) / freqSignals.length;
        weightedSum += avgFreq * 0.10;
        totalWeight += 0.10;
    }

    const peerMap = { much_better: 0.0, better: 0.2, same: 0.5, worse: 0.8, much_worse: 1.0 };
    const peers = empFeedbacks.filter(f => f.peerComparison).map(f => peerMap[f.peerComparison] ?? 0.5);
    if (peers.length > 0) {
        const avgPeer = peers.reduce((s, v) => s + v, 0) / peers.length;
        weightedSum += avgPeer * 0.05;
        totalWeight += 0.05;
    }

    const urgencyMap = { low: 0.0, medium: 0.5, high: 1.0 };
    const urgencies = empFeedbacks.filter(f => f.urgency).map(f => urgencyMap[f.urgency] ?? 0.0);
    if (urgencies.length > 0) {
        const avgUrg = urgencies.reduce((s, v) => s + v, 0) / urgencies.length;
        weightedSum += avgUrg * 0.05;
        totalWeight += 0.05;
    }


    const followUps = empFeedbacks.filter(f => f.willingToFollowUp != null);
    if (followUps.length > 0) {
        const followUpRate = followUps.filter(f => f.willingToFollowUp).length / followUps.length;
        weightedSum += followUpRate * 0.05;
        totalWeight += 0.05;
    }

    const ext = extendedMetrics || {};
    const envSignals = [
        ext.teamRetentionRate != null ? (100 - ext.teamRetentionRate) / 100 : null,
        ext.employeeEngagementScore != null ? (100 - ext.employeeEngagementScore) / 100 : null,
        ext.employeeGrowthRate != null ? (100 - ext.employeeGrowthRate) / 100 : null,
    ].filter(v => v != null);
    if (envSignals.length > 0) {
        const avgEnv = envSignals.reduce((s, v) => s + v, 0) / envSignals.length;
        weightedSum += avgEnv * 0.05;
        totalWeight += 0.05;
    }

    if (totalWeight === 0) return 50;
    const raw = (weightedSum / totalWeight) * 100;

    const perf = employee.performanceRating || 3;
    const perfBoost = perf >= 4 && raw > 50 ? (perf - 3) * 5 : 0;

    return clamp(Math.round(raw + perfBoost), 0, 100);
}


function computeFormulaImpactScore(employee, empFeedbacks, teamSize) {
    let totalWeight = 0;
    let weightedSum = 0;

    const perf = employee.performanceRating || 3;
    weightedSum += ((perf - 1) / 4) * 0.40;
    totalWeight += 0.40;

    if (teamSize > 0) {
        const sizeImpact = clamp(1 - (teamSize - 1) / 10, 0.3, 1.0);
        weightedSum += sizeImpact * 0.15;
        totalWeight += 0.15;
    }

    const peerMap = { much_better: 1.0, better: 0.75, same: 0.5, worse: 0.25, much_worse: 0.0 };
    const peers = empFeedbacks.filter(f => f.peerComparison).map(f => peerMap[f.peerComparison] ?? 0.5);
    if (peers.length > 0) {
        const avgPeer = peers.reduce((s, v) => s + v, 0) / peers.length;
        weightedSum += avgPeer * 0.10;
        totalWeight += 0.10;
    }

    const npsValues = empFeedbacks.filter(f => f.npsScore != null).map(f => f.npsScore);
    if (npsValues.length > 0) {
        const avgNPS = npsValues.reduce((s, v) => s + v, 0) / npsValues.length;
        weightedSum += (avgNPS / 10) * 0.10;
        totalWeight += 0.10;
    }

    if (empFeedbacks.length > 0) {
        const avgCommentLength = empFeedbacks.reduce((s, f) => s + (f.comment?.length || 0), 0) / empFeedbacks.length;
        const engagementDepth = clamp(avgCommentLength / 150, 0, 1); // 150+ chars = fully engaged
        weightedSum += engagementDepth * 0.10;
        totalWeight += 0.10;
    }

    const role = (employee.role || "").toLowerCase();
    let roleWeight = 0.5; // default
    if (role.includes("senior") || role.includes("lead") || role.includes("principal") || role.includes("architect")) {
        roleWeight = 0.9;
    } else if (role.includes("manager") || role.includes("director") || role.includes("head")) {
        roleWeight = 1.0;
    } else if (role.includes("specialist") || role.includes("strategist") || role.includes("designer")) {
        roleWeight = 0.7;
    } else if (role.includes("junior") || role.includes("intern") || role.includes("trainee")) {
        roleWeight = 0.3;
    }
    weightedSum += roleWeight * 0.15;
    totalWeight += 0.15;

    if (totalWeight === 0) return 50;
    return clamp(Math.round((weightedSum / totalWeight) * 100), 0, 100);
}

function getLevel(score) {
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
}

async function predictTeamAttrition(payload) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing");
    }

    const { manager, employees, feedbacks, metrics, extendedMetrics } = payload;

    const formulaPredictions = employees.map(emp => {
        const empFeedbacks = feedbacks.filter(
            f => f.fromEmployee === emp.name || f.employeeId?.toString() === emp._id?.toString()
        );

        const flightRisk = computeFormulaFlightRisk(emp, empFeedbacks, extendedMetrics);
        const impactScore = computeFormulaImpactScore(emp, empFeedbacks, employees.length);

        const empMetrics = metrics.filter(
            m => m.employeeId?.toString() === emp._id?.toString()
        );

        return {
            employeeName: emp.name,
            role: emp.role,
            performanceRating: emp.performanceRating,
            flightRisk,
            impactScore,
            riskLevel: getLevel(flightRisk),
            impactLevel: getLevel(impactScore),
            feedbackCount: empFeedbacks.length,
            metrics: empMetrics,
        };
    });

    console.log("📊 Formula-based attrition scores:");
    formulaPredictions.forEach(p =>
        console.log(`   ${p.employeeName}: Flight=${p.flightRisk}% (${p.riskLevel}), Impact=${p.impactScore}% (${p.impactLevel})`)
    );

    const prompt = `
You are an expert HR Data Scientist and Talent Strategist. 
A formula-based model has already computed initial Flight Risk and Impact scores for each employee.
Your job is to REFINE these scores (adjust by ±15 points max) based on qualitative analysis of the feedback text, team dynamics, and context.

Manager Context:
- Name: ${manager.name}
- Department: ${manager.department}
- Team Retention: ${extendedMetrics.teamRetentionRate ?? "N/A"}%
- Goal Completion: ${extendedMetrics.goalCompletionRate ?? "N/A"}%
- Promotion Rate: ${extendedMetrics.employeePromotionRate ?? "N/A"}%
- 360 Feedback Rating: ${extendedMetrics.subordinate360Rating ?? "N/A"}/100
- Engagement Score: ${extendedMetrics.employeeEngagementScore ?? "N/A"}/100
- Development Plans (IDP): ${extendedMetrics.IDP ?? "N/A"} active plans

Formula-Based Predictions & Employee Data:
${formulaPredictions.map(p => {
        const empFeedbacks = feedbacks.filter(
            f => f.fromEmployee === p.employeeName || f.employeeId?.toString() === employees.find(e => e.name === p.employeeName)?._id?.toString()
        );
        const feedbackSummary = empFeedbacks.map(f => {
            let line = `"${f.comment}" (Sentiment: ${Math.round((f.sentimentScore || 0.5) * 100)}%, Composite: ${Math.round((f.compositeFeedbackScore || f.sentimentScore || 0.5) * 100)}%)`;
            if (f.pulseMood) line += ` [Mood: ${f.pulseMood}]`;
            if (f.urgency) line += ` [Urgency: ${f.urgency}]`;
            if (f.feedbackType) line += ` [Type: ${f.feedbackType}]`;
            if (f.willingToFollowUp) line += ` [Wants Follow-up]`;
            return line;
        }).join("; ");

        const metricsSummary = p.metrics?.length > 0
            ? p.metrics.map(m => `- ${m.metricName}: ${m.value}`).join("; ")
            : "None";

        return `- ${p.employeeName} (${p.role}):
      Performance: ${p.performanceRating}/5
      Formula Flight Risk: ${p.flightRisk}% (${p.riskLevel})
      Formula Impact Score: ${p.impactScore}% (${p.impactLevel})
      Feedback: ${feedbackSummary || "None"}
      Custom Metrics: ${metricsSummary}
    `;
    }).join("\n")}

SCORING RULES:
1. You may adjust the formula Flight Risk and Impact Score by UP TO ±15 points based on qualitative signals in the feedback text.
2. Keywords like "burnout", "leaving", "frustrated", "lost", "no growth" should INCREASE flight risk.
3. Keywords like "inspiring", "thriving", "love", "great" should DECREASE flight risk.
4. High performers (4-5) with negative sentiment are CRITICAL flight risks — ensure this is reflected.
5. riskLevel and impactLevel must match: >=70 = "High", 40-69 = "Medium", <40 = "Low".

STRICT OUTPUT FORMAT — Return ONLY a JSON object:
{
  "predictions": [
    {
      "employeeName": "Name",
      "flightRisk": <integer 0-100>,
      "impactScore": <integer 0-100>,
      "riskLevel": "High" | "Medium" | "Low",
      "impactLevel": "High" | "Medium" | "Low",
      "rationale": "One sentence explaining the score, referencing specific feedback signals",
      "recommendation": "One specific, actionable retention or transition strategy"
    }
  ]
}
`.trim();

    const models = [
        "deepseek/deepseek-chat",
        "qwen/qwen3-coder:free",
        "google/gemma-3-12b-it:free",
    ];

    let lastError = null;
    for (const model of models) {
        try {
            const now = Date.now();
            if (now - lastCallTime < MIN_DELAY_MS) {
                await new Promise(r => setTimeout(r, MIN_DELAY_MS - (now - lastCallTime)));
            }
            lastCallTime = Date.now();

            console.log("🧠 Attrition Prediction model:", model);
            const completion = await openRouterClient.chat.completions.create({
                model,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 600,
            });

            const content = completion?.choices?.[0]?.message?.content;
            const parsed = safeParseJSONObject(content);

            if (parsed && Array.isArray(parsed.predictions)) {
                const refined = parsed.predictions.map(p => {
                    const formula = formulaPredictions.find(fp => fp.employeeName === p.employeeName);
                    let flightRisk = clamp(Math.round(p.flightRisk), 0, 100);
                    let impactScore = clamp(Math.round(p.impactScore), 0, 100);

                    if (formula) {
                        flightRisk = clamp(flightRisk, formula.flightRisk - 15, formula.flightRisk + 15);
                        impactScore = clamp(impactScore, formula.impactScore - 15, formula.impactScore + 15);
                    }

                    return {
                        ...p,
                        flightRisk,
                        impactScore,
                        riskLevel: getLevel(flightRisk),
                        impactLevel: getLevel(impactScore),
                    };
                });

                console.log("✅ AI-refined attrition scores:");
                refined.forEach(p =>
                    console.log(`   ${p.employeeName}: Flight=${p.flightRisk}% (${p.riskLevel}), Impact=${p.impactScore}% (${p.impactLevel})`)
                );

                return refined;
            }
        } catch (err) {
            console.error(`❌ Attrition Model ${model} failed:`, err.message);
            lastError = err.message;
        }
    }

    // Fallback: if all AI models fail, return formula-based predictions with default rationale
    console.warn("⚠️ All AI models failed for attrition. Returning formula-only predictions.");
    return formulaPredictions.map(p => ({
        employeeName: p.employeeName,
        flightRisk: p.flightRisk,
        impactScore: p.impactScore,
        riskLevel: p.riskLevel,
        impactLevel: p.impactLevel,
        rationale: `Formula-based: ${p.riskLevel} flight risk based on feedback sentiment, ratings, and behavioral signals.`,
        recommendation: p.flightRisk >= 70
            ? "Schedule an urgent 1-on-1 to understand concerns and discuss career growth."
            : p.flightRisk >= 40
                ? "Proactively check in and ensure the employee feels supported and valued."
                : "Continue current engagement practices. Monitor for changes in sentiment.",
    }));
}

module.exports = { predictTeamAttrition, computeFormulaFlightRisk };
