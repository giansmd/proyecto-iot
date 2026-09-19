import { MAX_ANALYSIS_INTERVAL_MINUTES } from "@iot/shared";
import type { FastifyInstance } from "fastify";
import type { Worker } from "bullmq";
import type { Pool } from "pg";
import { AlertActionUseCase, ListAlertsUseCase, ListScansUseCase } from "./application/use-cases/alerts.js";
import {
  ListDevicesUseCase,
  RequestAnalysisNowUseCase,
  UpdateDeviceSettingsUseCase,
} from "./application/use-cases/device-settings.js";
import { AnalyzeDeviceUseCase } from "./application/use-cases/analyze-device.js";
import { IngestImageUseCase } from "./application/use-cases/ingest-image.js";
import { GetUsageUseCase } from "./application/use-cases/usage.js";
import { loadConfig, type AppConfig } from "./config.js";
import { buildServer } from "./infrastructure/http/server.js";
import {
  DrizzleAlertRepository,
  DrizzleDeviceRepository,
  DrizzleScanRepository,
  DrizzleUsageRepository,
} from "./infrastructure/persistence/repositories.js";
import { createDb } from "./infrastructure/persistence/db.js";
import { BullAnalysisJobs, createAnalysisQueue, registerScheduler, type AnalysisQueue } from "./infrastructure/queue/queue.js";
import { createAnalysisWorker } from "./infrastructure/queue/worker.js";
import { RedisFrameStore } from "./infrastructure/redis/frame-store.js";
import { createRedis, type Redis } from "./infrastructure/redis/redis.js";
import { RedisEventPublisher } from "./infrastructure/realtime/event-publisher.js";
import {
  NoopVisionAdapter,
  OpenAIVisionAdapter,
} from "./infrastructure/vision/openai-vision.adapter.js";

export interface Container {
  config: AppConfig;
  server: FastifyInstance;
  worker: Worker;
  queue: AnalysisQueue;
  pool: Pool;
  clients: Redis[];
}

export async function createContainer(): Promise<Container> {
  const config = loadConfig();

  const { db, pool } = createDb(config.DATABASE_URL);

  const redisMain = createRedis(config.REDIS_URL);
  const redisQueue = createRedis(config.REDIS_URL);
  const redisWorker = createRedis(config.REDIS_URL);
  const redisSub = createRedis(config.REDIS_URL);
  const clients = [redisMain, redisQueue, redisWorker, redisSub];

  const devices = new DrizzleDeviceRepository(db);
  const scans = new DrizzleScanRepository(db);
  const alerts = new DrizzleAlertRepository(db);
  const usage = new DrizzleUsageRepository(db);

  const frames = new RedisFrameStore(
    redisMain,
    MAX_ANALYSIS_INTERVAL_MINUTES * 60,
  );
  const publisher = new RedisEventPublisher(redisMain);

  const vision = config.OPENAI_API_KEY
    ? new OpenAIVisionAdapter({
        apiKey: config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
        detail: config.OPENAI_IMAGE_DETAIL,
        maxOutputTokens: config.OPENAI_MAX_OUTPUT_TOKENS,
        timeoutMs: config.OPENAI_TIMEOUT_MS,
      })
    : new NoopVisionAdapter();

  const queue = createAnalysisQueue(redisQueue);
  const jobs = new BullAnalysisJobs(queue);

  const ingest = new IngestImageUseCase({
    devices,
    frames,
    defaultIntervalMinutes: config.DEFAULT_ANALYSIS_INTERVAL_MINUTES,
  });

  const analyze = new AnalyzeDeviceUseCase({
    devices,
    scans,
    alerts,
    frames,
    usage,
    vision,
    publisher,
    budgetUsd: config.OPENAI_BUDGET_USD,
    staleFactor: config.FRAME_STALE_FACTOR,
    inputPricePer1M: config.OPENAI_INPUT_PRICE_PER_1M,
    outputPricePer1M: config.OPENAI_OUTPUT_PRICE_PER_1M,
  });

  const deviceQueryDeps = {
    devices,
    frames,
    staleFactor: config.FRAME_STALE_FACTOR,
    publisher,
  };

  const useCases = {
    ingest,
    listDevices: new ListDevicesUseCase(deviceQueryDeps),
    updateDeviceSettings: new UpdateDeviceSettingsUseCase(deviceQueryDeps),
    requestAnalysisNow: new RequestAnalysisNowUseCase(jobs),
    listAlerts: new ListAlertsUseCase(alerts),
    alertAction: new AlertActionUseCase(alerts, publisher),
    listScans: new ListScansUseCase(scans),
    getUsage: new GetUsageUseCase(usage, config.OPENAI_BUDGET_USD),
  };

  const worker = createAnalysisWorker(redisWorker, {
    queue,
    analyze,
    devices,
  });
  await registerScheduler(queue);

  const server = await buildServer({
    config,
    subscriber: redisSub,
    useCases,
  });

  return { config, server, worker, queue, pool, clients };
}
