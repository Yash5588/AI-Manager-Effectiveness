const MOOD_SCORE_MAP = {
  thriving: 1.0,
  happy: 0.75,
  neutral: 0.5,
  stressed: 0.25,
  struggling: 0.0,
};

const FREQUENCY_SCORE_MAP = {
  weekly: 1.0,
  biweekly: 0.75,
  monthly: 0.5,
  rarely: 0.25,
  never: 0.0,
  after_every_task: 1.0,
  same_day: 1.0,
  within_week: 0.75,
  within_month: 0.5,
};

const PEER_SCORE_MAP = {
  much_better: 1.0,
  better: 0.75,
  same: 0.5,
  worse: 0.25,
  much_worse: 0.0,
};

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeCompositeFeedbackScore(feedback) {
  let totalWeight = 0;
  let weightedSum = 0;

  if (feedback.sentimentScore != null) {
    weightedSum += feedback.sentimentScore * 0.30;
    totalWeight += 0.30;
  }

  if (feedback.ratings) {
    const ratingValues = Object.values(feedback.ratings).filter((value) => value != null && value > 0);
    const avgRating = average(ratingValues);
    if (avgRating != null) {
      weightedSum += ((avgRating - 1) / 4) * 0.25;
      totalWeight += 0.25;
    }
  }

  if (feedback.npsScore != null) {
    weightedSum += (feedback.npsScore / 10) * 0.15;
    totalWeight += 0.15;
  }

  if (feedback.pulseMood) {
    weightedSum += (MOOD_SCORE_MAP[feedback.pulseMood] ?? 0.5) * 0.10;
    totalWeight += 0.10;
  }

  const frequencyValues = [
    feedback.oneOnOneFrequency ? FREQUENCY_SCORE_MAP[feedback.oneOnOneFrequency] : null,
    feedback.feedbackFrequency ? FREQUENCY_SCORE_MAP[feedback.feedbackFrequency] : null,
    feedback.concernResponseTime ? FREQUENCY_SCORE_MAP[feedback.concernResponseTime] : null,
  ].filter((value) => value != null);
  const avgFrequency = average(frequencyValues);
  if (avgFrequency != null) {
    weightedSum += avgFrequency * 0.10;
    totalWeight += 0.10;
  }

  if (feedback.peerComparison) {
    weightedSum += (PEER_SCORE_MAP[feedback.peerComparison] ?? 0.5) * 0.10;
    totalWeight += 0.10;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

module.exports = { computeCompositeFeedbackScore };
