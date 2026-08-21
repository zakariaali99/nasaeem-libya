export type RfmWindowLabel = "30d" | "90d";

export type ScoreBand = {
  min: number;
  max?: number;
  score: number;
};

export type RfmScale = {
  recency: ScoreBand[];
  frequency: ScoreBand[];
  monetary: ScoreBand[];
  // future dimensions keyed by name
  dimensions?: Record<string, ScoreBand[]>;
};

export type RfmWeights = {
  recency: number;
  frequency: number;
  monetary: number;
  [dimension: string]: number;
};

export type RfmConfig = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  recencyWindowDays: number;
  frequencyWindowDays: number;
  monetaryWindowDays: number;
  scale: RfmScale;
  weights: RfmWeights;
  dimensions?: Record<string, ScoreBand[]>;
  staleAfterHours?: number;
};

export type RfmMetrics = {
  userId: string;
  windowLabel: RfmWindowLabel;
  recencyDays: number | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
};

export type RfmScore = {
  userId: string;
  windowLabel: RfmWindowLabel;
  configId: string;
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  totalScore: number;
  segment: string;
  metrics: RfmMetrics;
  dimensions?: Record<string, number>;
  computedAt: Date;
  staleAfter?: Date | null;
};

export type RfmJobInput = {
  windowLabel?: RfmWindowLabel;
  configId?: string;
  batchSize?: number;
  offset?: number;
  userIds?: string[];
  force?: boolean;
  dryRun?: boolean;
};

export type RfmChildJobData = {
  userId: string;
  windowLabel: RfmWindowLabel;
  configId: string;
  dryRun?: boolean;
};

export const DEFAULT_WINDOWS: ReadonlyArray<RfmWindowLabel> = ["30d", "90d"] as const;
