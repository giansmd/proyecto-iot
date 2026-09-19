import { updateDeviceSettingsSchema } from "@iot/shared";
import type { FastifyInstance } from "fastify";
import type {
  ListDevicesUseCase,
  RequestAnalysisNowUseCase,
  UpdateDeviceSettingsUseCase,
} from "../../../application/use-cases/device-settings.js";
import type { GetLatestFrameUseCase } from "../../../application/use-cases/frame.js";

export interface DevicesContext {
  listDevices: ListDevicesUseCase;
  updateDeviceSettings: UpdateDeviceSettingsUseCase;
  requestAnalysisNow: RequestAnalysisNowUseCase;
  getFrame: GetLatestFrameUseCase;
}

export function registerDevicesRoutes(
  app: FastifyInstance,
  ctx: DevicesContext,
): void {
  app.get("/api/devices", async () => ctx.listDevices.execute());

  app.patch("/api/devices/:id/settings", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateDeviceSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid-body", details: parsed.error.issues });
    }
    const device = await ctx.updateDeviceSettings.execute(id, parsed.data);
    if (!device) return reply.code(404).send({ error: "device-not-found" });
    return device;
  });

  app.post("/api/devices/:id/analyze-now", async (request, reply) => {
    const { id } = request.params as { id: string };
    await ctx.requestAnalysisNow.execute(id);
    return reply.code(202).send({ queued: true, deviceId: id });
  });

  app.get("/api/devices/:id/frame", async (request, reply) => {
    const { id } = request.params as { id: string };
    const frame = await ctx.getFrame.execute(id);
    if (!frame) return reply.code(404).send({ error: "frame-not-found" });
    return reply
      .header("content-type", "image/jpeg")
      .header("cache-control", "no-store")
      .send(frame.data);
  });
}
