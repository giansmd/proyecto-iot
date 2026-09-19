import { Worker } from "bullmq";
import type { AnalyzeDeviceUseCase } from "../../application/use-cases/analyze-device.js";
import type { DeviceRepository } from "../../domain/ports.js";
import type { Redis } from "../redis/redis.js";
import {
  ANALYSIS_QUEUE,
  ANALYZE_JOB,
  TICK_JOB,
  type AnalysisQueue,
} from "./queue.js";

export interface AnalysisWorkerDeps {
  queue: AnalysisQueue;
  analyze: AnalyzeDeviceUseCase;
  devices: DeviceRepository;
}

export function createAnalysisWorker(
  connection: Redis,
  deps: AnalysisWorkerDeps,
): Worker {
  const worker = new Worker(
    ANALYSIS_QUEUE,
    async (job) => {
      if (job.name === TICK_JOB) {
        const due = await deps.devices.findDue(new Date());
        const minute = Math.floor(Date.now() / 60_000);
        for (const device of due) {
          await deps.queue.add(
            ANALYZE_JOB,
            { deviceId: device.id, reason: "schedule" },
            {
              jobId: `${device.id}:${minute}`,
              removeOnComplete: 100,
              removeOnFail: 100,
            },
          );
        }
        return { due: due.length };
      }

      const data = job.data as { deviceId: string };
      return deps.analyze.execute(data.deviceId);
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, error) => {
    console.error(`[worker] job ${job?.name ?? "?"} fallo:`, error.message);
  });

  return worker;
}
