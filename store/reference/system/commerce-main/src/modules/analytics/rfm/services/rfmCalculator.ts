import { RfmConfig, RfmMetrics, RfmScore, ScoreBand } from "../types";

function scoreValue(value: number, bands: ScoreBand[], fallback = 1): number {
  const resolved = bands.find((band) => value >= band.min && (band.max === undefined || value <= band.max));
  return resolved?.score ?? fallback;
}

function normalizeWeights(weights: Record<string, number>) {
  const entries = Object.entries(weights);
  const total = entries.reduce((acc, [, v]) => acc + (Number.isFinite(v) ? v : 0), 0) || 1;
  return entries.reduce<Record<string, number>>((acc, [key, val]) => {
    acc[key] = (Number.isFinite(val) ? val : 0) / total;
    return acc;
  }, {});
}

function deriveSegment(recencyScore: number, frequencyScore: number, monetaryScore: number): string {
  if (recencyScore >= 4 && frequencyScore >= 4 && monetaryScore >= 4) return "عميل ذهبي";
  if (recencyScore >= 3 && frequencyScore >= 3) return "عميل وفي";
  if (recencyScore <= 2 && frequencyScore <= 2) return "عميل معرض للفقد";
  if (recencyScore >= 4 && frequencyScore <= 2) return "عميل جديد واعد";
  return "عميل قياسي";
}

export function calculateRfmScore(metrics: RfmMetrics, config: RfmConfig): RfmScore {
  const bands = config.scale;
  const recencyValue = metrics.recencyDays ?? Number.MAX_SAFE_INTEGER;
  const recencyScore = scoreValue(recencyValue, bands.recency);
  const frequencyScore = scoreValue(metrics.orderCount, bands.frequency);
  const monetaryScore = scoreValue(metrics.totalSpent, bands.monetary);

  const mergedWeights = Object.assign({ recency: 1, frequency: 1, monetary: 1 }, config.weights);
  const normalizedWeights = normalizeWeights(mergedWeights);

  const totalScore = Math.round(
    (recencyScore * (normalizedWeights.recency ?? 0)) +
    (frequencyScore * (normalizedWeights.frequency ?? 0)) +
    (monetaryScore * (normalizedWeights.monetary ?? 0))
  );

  const dimensionScores: Record<string, number> = {};
  if (config.scale.dimensions && metrics) {
    for (const [key, band] of Object.entries(config.scale.dimensions)) {
      const metricValue = (metrics as any)[key];
      if (typeof metricValue === "number") {
        dimensionScores[key] = scoreValue(metricValue, band);
      }
    }
  }

  const segment = deriveSegment(recencyScore, frequencyScore, monetaryScore);

  const staleAfter = metrics.lastOrderAt
    ? new Date(metrics.lastOrderAt.getTime() + (config.recencyWindowDays * 24 * 60 * 60 * 1000))
    : null;

  return {
    userId: metrics.userId,
    windowLabel: metrics.windowLabel,
    configId: config.id,
    recencyScore,
    frequencyScore,
    monetaryScore,
    totalScore,
    segment,
    metrics,
    dimensions: Object.keys(dimensionScores).length ? dimensionScores : undefined,
    computedAt: new Date(),
    staleAfter,
  };
}
