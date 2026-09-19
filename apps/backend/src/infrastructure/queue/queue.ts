import { Queue } from "bullmq";
import type { AnalysisJobs } from "../../domain/ports.js";
import type { Redis } from "../redis/redis.js";

export const ANALYSIS_QUEUE = "analysis";
export const TICK_JOB = "tick";
export const ANALYZE_JOB = "analyze";
export const SCHEDULER_ID = "due-scan";

export type AnalysisJobData =
  | { deviceId: string; reason: "schedule" | "manual" }
  | { reason: "tick" };

export type AnalysisQueue = Queue<AnalysisJobData>;

export function createAnalysisQueue(connection: Redis): AnalysisQueue {
  return new Queue<AnalysisJobData>(ANALYSIS_QUEUE, { connection });
}

export async function registerScheduler(queue: AnalysisQueue): Promise<void> {
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { every: 60_000 },
    { name: TICK_JOB, data: { reason: "tick" } },
  );
}

export class BullAnalysisJobs implements AnalysisJobs {
  constructor(private readonly queue: AnalysisQueue) {}

  async enqueueNow(deviceId: string): Promise<void> {
    await this.queue.add(
      ANALYZE_JOB,
      { deviceId, reason: "manual" },
      {
        jobId: `manual:${deviceId}:${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}
