/**
 * Teams Transcript Sentiment Analysis Service
 *
 * Provides sample Microsoft Teams meeting transcripts and chat messages
 * per employee, and uses LLM to analyze sentiment from them.
 */

// Sample Teams meeting transcripts & chat messages per employee
// In production these would come from Microsoft Graph API
const sampleTranscripts = {
    "Sam Wilson": {
        meetings: [
            {
                title: "Sprint Planning - Week 14",
                date: "2026-04-07",
                transcript: `Manager: Sam, how are things going with the ops dashboard?
Sam Wilson: Honestly, it's been tough. The requirements keep changing mid-sprint and I'm struggling to keep up. I feel like I'm always behind.
Manager: I understand. What can we do to help?
Sam Wilson: I think clearer specs upfront would help a lot. Also, I've been putting in extra hours and it's starting to affect me.
Manager: Let's discuss workload in our 1:1.`,
            },
            {
                title: "Team Standup - Apr 10",
                date: "2026-04-10",
                transcript: `Sam Wilson: I'm blocked on the integration piece. Waiting on the API team for two days now. It's frustrating because the deadline isn't moving.
Manager: Let me escalate that today.
Sam Wilson: Thanks. Also, I want to flag that I'm feeling a bit disconnected from the team lately.`,
            },
        ],
        chats: [
            { date: "2026-04-08", message: "Hey, can we push the demo? I don't think we're ready and I don't want to embarrass the team." },
            { date: "2026-04-11", message: "The new process changes are making everything slower. I miss how we used to work." },
            { date: "2026-04-14", message: "Good news - finally got the API access. Feeling more positive about hitting the deadline now 🙌" },
        ],
    },
    "Taylor Brown": {
        meetings: [
            {
                title: "1:1 with Manager - Apr 8",
                date: "2026-04-08",
                transcript: `Manager: Taylor, how's the analysis project?
Taylor Brown: It's going well! I really enjoyed the new dataset we got. The patterns are interesting.
Manager: Great to hear. Any concerns?
Taylor Brown: One thing - I'd love more visibility into how my work impacts decisions. Sometimes I feel like my reports go into a void.
Manager: That's fair feedback. Let me connect you with the strategy team.`,
            },
            {
                title: "Team Retro - Apr 12",
                date: "2026-04-12",
                transcript: `Taylor Brown: I think we did great this sprint. The collaboration with the dev team was smooth. I'm proud of what we delivered.
Taylor Brown: One improvement - can we have shorter meetings? Some of them run way too long and cut into focus time.`,
            },
        ],
        chats: [
            { date: "2026-04-09", message: "Just finished the market analysis report. Feeling good about the insights we pulled! 📊" },
            { date: "2026-04-13", message: "Can someone help me with the Tableau dashboard? Happy to learn but need a quick walkthrough." },
            { date: "2026-04-15", message: "Really enjoyed the team lunch yesterday. These bonding moments matter a lot." },
        ],
    },
    "Jamie Doe": {
        meetings: [
            {
                title: "Project Kickoff - Operations Revamp",
                date: "2026-04-07",
                transcript: `Jamie Doe: I'm excited about this project! I think there's a lot of room for improvement in our current processes.
Manager: What's your initial plan?
Jamie Doe: I've already mapped out the bottlenecks. I want to tackle the scheduling issue first since it affects everyone.
Manager: Sounds like a solid approach.`,
            },
            {
                title: "Weekly Check-in - Apr 14",
                date: "2026-04-14",
                transcript: `Manager: Jamie, how are things progressing?
Jamie Doe: Really well. I've been coordinating with three departments and everyone is on board. The energy around this project is great.
Jamie Doe: My only concern is timeline - we might need an extra week for testing.`,
            },
        ],
        chats: [
            { date: "2026-04-08", message: "Submitted the process improvement proposal. Fingers crossed! 🤞" },
            { date: "2026-04-11", message: "Great meeting today. I love working with people who are passionate about making things better." },
            { date: "2026-04-15", message: "The new scheduling tool is already saving us 2 hours a week. Small wins! 🎯" },
        ],
    },
    "Casey Smith": {
        meetings: [
            {
                title: "1:1 with Manager - Apr 9",
                date: "2026-04-09",
                transcript: `Manager: Casey, let's catch up. How are you feeling about things?
Casey Smith: To be honest, not great. I've been passed over for the lead role again and I'm starting to question my future here.
Manager: I hear you. Let's talk about your growth path.
Casey Smith: I've been here 3 years and I feel like I'm stuck. I need to see some movement or I'll have to explore other options.`,
            },
            {
                title: "Logistics Review - Apr 11",
                date: "2026-04-11",
                transcript: `Casey Smith: The supply chain delays are getting worse. I've flagged this three times now and nothing has changed.
Manager: We're working on it from the vendor side.
Casey Smith: I hope so. It's demoralizing when you keep raising issues and see no action.`,
            },
        ],
        chats: [
            { date: "2026-04-10", message: "Another day, another delayed shipment. This is exhausting 😔" },
            { date: "2026-04-12", message: "Is anyone else frustrated with the new approval workflow? It adds 2 days to everything." },
            { date: "2026-04-14", message: "On a positive note, the team dinner was nice. Good to connect outside of work." },
        ],
    },
};

/**
 * Get sample transcripts for a manager's employees.
 * In production, this would call Microsoft Graph API.
 */
function getTranscriptsForManager(employeeNames) {
    const result = {};
    for (const name of employeeNames) {
        if (sampleTranscripts[name]) {
            result[name] = sampleTranscripts[name];
        }
    }
    return result;
}

/**
 * Build an AI prompt to analyze sentiment from Teams transcripts.
 */
function buildTranscriptAnalysisPrompt(employeeName, data) {
    const meetingTexts = (data.meetings || [])
        .map((m) => `[Meeting: ${m.title} - ${m.date}]\n${m.transcript}`)
        .join("\n\n");

    const chatTexts = (data.chats || [])
        .map((c) => `[Chat ${c.date}]: ${c.message}`)
        .join("\n");

    return `
Analyze the sentiment of employee "${employeeName}" based on their Microsoft Teams meeting transcripts and chat messages below.

Return ONLY a valid JSON object with this structure:
{
  "overallSentiment": <number 0.0 to 1.0, where 0 = very negative, 0.5 = neutral, 1.0 = very positive>,
  "sentimentLabel": "Positive" | "Neutral" | "Negative",
  "emotionalState": "<one word like 'Frustrated', 'Engaged', 'Disengaged', 'Motivated', 'Anxious', 'Confident'>",
  "keyThemes": ["<theme1>", "<theme2>", "<theme3>"],
  "topConcern": "<main concern or worry expressed, or null if none>",
  "positiveSignal": "<strongest positive signal if any, or null if none>",
  "riskFlag": true | false,
  "summary": "<2-sentence summary of their sentiment and engagement level>"
}

STRICT: Output ONLY JSON. No markdown, no explanation.

── MEETING TRANSCRIPTS ──
${meetingTexts}

── TEAMS CHAT MESSAGES ──
${chatTexts}
`.trim();
}

module.exports = {
    sampleTranscripts,
    getTranscriptsForManager,
    buildTranscriptAnalysisPrompt,
};
