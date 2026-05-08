import type { LeaderboardEntry, PeerTrendBenchmark } from "@/lib/api";

function buildMonthTimeline(months: number) {
  const now = new Date();
  const points = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      monthKey: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
      label: dt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    });
  }

  return points;
}

export function buildPeerFallbackBenchmark(
  leaderboard: LeaderboardEntry[],
  managerId: string,
  months: number,
  currentScore: number
): PeerTrendBenchmark {
  const timeline = buildMonthTimeline(Math.max(3, months));
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank || b.effectivenessScore - a.effectivenessScore);

  const self = sorted.find((manager) => manager.id === managerId) || {
    id: managerId,
    rank: 1,
    name: "You",
    effectivenessScore: currentScore,
    category: "N/A",
  };
  const totalPeers = Math.max(1, sorted.length || 1);
  const selfRank = self.rank || 1;
  const top = sorted[0] || self;
  const above = selfRank > 1 ? sorted[selfRank - 2] : null;
  const below = selfRank < totalPeers ? sorted[selfRank] : null;
  const topPercentile = totalPeers > 1
    ? Math.round(((totalPeers - selfRank) / (totalPeers - 1)) * 100)
    : 100;

  const constantPoints = (score: number) =>
    timeline.map((month) => ({ monthKey: month.monthKey, label: month.label, score }));

  const series: PeerTrendBenchmark["series"] = [
    {
      key: "self",
      relation: "self",
      managerId: self.id,
      name: `${self.name} (You)`,
      rank: selfRank,
      latestScore: self.effectivenessScore,
      points: constantPoints(self.effectivenessScore),
    },
  ];

  if (top.id !== self.id) {
    series.push({
      key: "top",
      relation: "top",
      managerId: top.id,
      name: `${top.name} (Top)`,
      rank: top.rank,
      latestScore: top.effectivenessScore,
      points: constantPoints(top.effectivenessScore),
    });
  }

  if (above && above.id !== self.id && above.id !== top.id) {
    series.push({
      key: "above",
      relation: "above",
      managerId: above.id,
      name: `${above.name} (Ahead)`,
      rank: above.rank,
      latestScore: above.effectivenessScore,
      points: constantPoints(above.effectivenessScore),
    });
  }

  if (below && below.id !== self.id) {
    series.push({
      key: "below",
      relation: "below",
      managerId: below.id,
      name: `${below.name} (Behind)`,
      rank: below.rank,
      latestScore: below.effectivenessScore,
      points: constantPoints(below.effectivenessScore),
    });
  }

  const avgScore = Math.round(
    (sorted.length > 0 ? sorted.reduce((sum, item) => sum + item.effectivenessScore, 0) : currentScore) /
    Math.max(1, sorted.length)
  );

  series.push({
    key: "peer_avg",
    relation: "peer_avg",
    managerId: null,
    name: "Peer Average",
    rank: null,
    latestScore: avgScore,
    points: constantPoints(avgScore),
  });

  return {
    timeframe: {
      months,
      start: timeline[0]?.monthKey ?? null,
      end: timeline[timeline.length - 1]?.monthKey ?? null,
    },
    summary: {
      rank: selfRank,
      totalPeers,
      topPercentile,
      tier: topPercentile >= 90 ? "Champion" : topPercentile >= 70 ? "Elite" : topPercentile >= 40 ? "Contender" : "Rising",
      currentScore: self.effectivenessScore,
      category: self.category || "N/A",
      scoreGapToTop: Math.max(0, (top.effectivenessScore || self.effectivenessScore) - self.effectivenessScore),
      scoreGapToNext: above ? Math.max(0, above.effectivenessScore - self.effectivenessScore) : 0,
      scoreLeadOverBelow: below ? Math.max(0, self.effectivenessScore - below.effectivenessScore) : 0,
      nextManagerName: above ? above.name : null,
      belowManagerName: below ? below.name : null,
      abovePeerAverageStreak: self.effectivenessScore >= avgScore ? months : 0,
    },
    series,
  };
}
