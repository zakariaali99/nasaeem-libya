import MessageQueue from "@/modules/message_queue";
import { calculateRfmScore } from "./rfmCalculator";
import { getActiveConfig } from "./rfmConfigService";
import { fetchUserIdsForWindow, loadUserMetrics, saveRfmScore } from "./rfmRepository";
import { RfmChildJobData, RfmJobInput, RfmWindowLabel } from "../types";

const RFM_QUEUE_NAME = "analytics-rfm";
const JOB_BACKFILL = "rfm:backfill";
const JOB_COMPUTE_BATCH = "rfm:compute-batch";
const JOB_COMPUTE_USER = "rfm:compute-user";
const NIGHTLY_TZ = "Africa/Tripoli";

const WINDOW_DAY_MAP: Record<RfmWindowLabel, number> = {
  "30d": 30,
  "90d": 90,
};

const DEFAULT_BATCH_SIZE = 500;

let workerInitialized = false;

export function ensureRfmWorker() {
  if (workerInitialized) return;
  MessageQueue.processQueue(RFM_QUEUE_NAME, async (job) => {
    if (job.name === JOB_BACKFILL) return handleBackfillJob(job.data as RfmJobInput);
    if (job.name === JOB_COMPUTE_BATCH) return { ok: true, batch: job.data };
    if (job.name === JOB_COMPUTE_USER) return handleComputeUserJob(job.data as RfmChildJobData);
    console.warn(`تجاهل وظيفة غير معروفة: ${job.name}`);
    return null;
  }, 5);
  workerInitialized = true;
}

export async function enqueueRfmBackfill(input: RfmJobInput) {
  ensureRfmWorker();
  const windowLabel: RfmWindowLabel = input.windowLabel ?? "30d";
  const payload: RfmJobInput = {
    windowLabel,
    configId: input.configId,
    batchSize: input.batchSize ?? DEFAULT_BATCH_SIZE,
    offset: input.offset ?? 0,
    userIds: input.userIds,
    force: input.force,
    dryRun: input.dryRun ?? false,
  };
  return MessageQueue.addJob(RFM_QUEUE_NAME, JOB_BACKFILL, payload, {
    removeOnComplete: true,
    attempts: 3,
    backoff: { type: "exponential", delay: 1500 },
  });
}

export async function scheduleNightlyRfm() {
  ensureRfmWorker();
  await MessageQueue.addJob(
    RFM_QUEUE_NAME,
    JOB_BACKFILL,
    { windowLabel: "30d" },
    {
      jobId: "rfm:nightly:30d",
      removeOnComplete: true,
      removeOnFail: false,
      repeat: { cron: "0 2 * * *", tz: NIGHTLY_TZ },
    }
  );

  await MessageQueue.addJob(
    RFM_QUEUE_NAME,
    JOB_BACKFILL,
    { windowLabel: "90d" },
    {
      jobId: "rfm:nightly:90d",
      removeOnComplete: true,
      removeOnFail: false,
      repeat: { cron: "30 2 * * *", tz: NIGHTLY_TZ },
    }
  );

  return { scheduled: true, tz: NIGHTLY_TZ };
}

async function handleBackfillJob(data: RfmJobInput) {
  const config = await getActiveConfig(data.configId);
  const windowLabel: RfmWindowLabel = data.windowLabel ?? "30d";
  const windowDays = WINDOW_DAY_MAP[windowLabel];
  const batchSize = data.batchSize ?? DEFAULT_BATCH_SIZE;
  const offset = data.offset ?? 0;

  const userIds = data.userIds?.length
    ? data.userIds.slice(0, batchSize)
    : await fetchUserIdsForWindow(windowDays, batchSize, offset);

  if (!userIds.length) {
    return { status: "no-users", windowLabel, offset };
  }

  await MessageQueue.addFlow({
    name: JOB_COMPUTE_BATCH,
    queueName: RFM_QUEUE_NAME,
    data: { windowLabel, batchSize, offset, configId: config.id },
    children: userIds.map((userId) => ({
      name: JOB_COMPUTE_USER,
      queueName: RFM_QUEUE_NAME,
      data: {
        userId,
        windowLabel,
        configId: config.id,
        dryRun: data.dryRun ?? false,
      },
    })),
  });

  if (!data.userIds && userIds.length === batchSize) {
    await MessageQueue.addJob(RFM_QUEUE_NAME, JOB_BACKFILL, {
      ...data,
      configId: config.id,
      offset: offset + batchSize,
      batchSize,
    }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: "exponential", delay: 1500 },
    });
  }

  return {
    status: "scheduled",
    windowLabel,
    scheduled: userIds.length,
    nextOffset: data.userIds ? undefined : offset + userIds.length,
  };
}

async function handleComputeUserJob(data: RfmChildJobData) {
  const windowDays = WINDOW_DAY_MAP[data.windowLabel];
  const config = await getActiveConfig(data.configId);
  const metrics = await loadUserMetrics(data.userId, windowDays);
  // enforce requested window label in case the repository maps by days
  const enrichedMetrics = { ...metrics, windowLabel: data.windowLabel } as typeof metrics;

  const score = calculateRfmScore(enrichedMetrics, config);

  if (data.dryRun) {
    return { status: "dry-run", score };
  }

  await saveRfmScore(score);
  return { status: "stored", userId: data.userId, windowLabel: data.windowLabel };
}
