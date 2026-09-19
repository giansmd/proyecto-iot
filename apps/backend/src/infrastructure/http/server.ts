import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "../../config.js";
import type { AlertActionUseCase, ListAlertsUseCase, ListScansUseCase } from "../../application/use-cases/alerts.js";
import type {
  ListDevicesUseCase,
  RequestAnalysisNowUseCase,
  UpdateDeviceSettingsUseCase,
} from "../../application/use-cases/device-settings.js";
import type { IngestImageUseCase } from "../../application/use-cases/ingest-image.js";
import type { GetLatestFrameUseCase } from "../../application/use-cases/frame.js";
import type { GetUsageUseCase } from "../../application/use-cases/usage.js";
import { EVENTS_CHANNEL } from "../realtime/event-publisher.js";
import type { Redis } from "../redis/redis.js";
import { registerAlertsRoutes } from "./routes/alerts.route.js";
import { registerDevicesRoutes } from "./routes/devices.route.js";
import { registerIngestRoute } from "./routes/ingest.route.js";
import { registerUsageRoute } from "./routes/usage.route.js";

interface WsLike {
  readyState: number;
  send(data: string): void;
  on(event: "close", cb: () => void): void;
}

export interface HttpDeps {
  config: AppConfig;
  subscriber: Redis;
  useCases: {
    ingest: IngestImageUseCase;
    listDevices: ListDevicesUseCase;
    updateDeviceSettings: UpdateDeviceSettingsUseCase;
    requestAnalysisNow: RequestAnalysisNowUseCase;
    listAlerts: ListAlertsUseCase;
    alertAction: AlertActionUseCase;
    listScans: ListScansUseCase;
    getFrame: GetLatestFrameUseCase;
    getUsage: GetUsageUseCase;
  };
}

export async function buildServer(deps: HttpDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    bodyLimit: config.MAX_UPLOAD_BYTES,
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(websocket);

  app.addContentTypeParser(
    /^image\/[\w.+-]+;?$/,
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  registerIngestRoute(app, { config, ingest: deps.useCases.ingest });
  registerDevicesRoutes(app, deps.useCases);
  registerAlertsRoutes(app, deps.useCases);
  registerUsageRoute(app, deps.useCases.getUsage);

  const clients = new Set<WsLike>();
  await deps.subscriber.subscribe(EVENTS_CHANNEL);
  deps.subscriber.on("message", (channel, message) => {
    if (channel !== EVENTS_CHANNEL) return;
    for (const client of clients) {
      if (client.readyState === 1) client.send(message);
    }
  });

  app.get("/ws", { websocket: true }, (socket) => {
    const ws = socket as unknown as WsLike;
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  return app;
}
