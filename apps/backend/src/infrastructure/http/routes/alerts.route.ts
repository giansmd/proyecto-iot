import { alertStatusSchema } from "@iot/shared";
import type { FastifyInstance } from "fastify";
import type {
  AlertActionUseCase,
  ListAlertsUseCase,
  ListScansUseCase,
} from "../../../application/use-cases/alerts.js";

export interface AlertsContext {
  listAlerts: ListAlertsUseCase;
  alertAction: AlertActionUseCase;
  listScans: ListScansUseCase;
}

export function registerAlertsRoutes(
  app: FastifyInstance,
  ctx: AlertsContext,
): void {
  app.get("/api/alerts", async (request) => {
    const query = request.query as { status?: string };
    const parsed = query.status
      ? alertStatusSchema.safeParse(query.status)
      : null;
    return ctx.listAlerts.execute(parsed?.success ? parsed.data : undefined);
  });

  app.post("/api/alerts/:id/ack", async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = await ctx.alertAction.execute(Number(id), "ack");
    if (!alert) return reply.code(404).send({ error: "alert-not-found" });
    return alert;
  });

  app.post("/api/alerts/:id/resolve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const alert = await ctx.alertAction.execute(Number(id), "resolve");
    if (!alert) return reply.code(404).send({ error: "alert-not-found" });
    return alert;
  });

  app.get("/api/devices/:id/scans", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit ?? 50) || 50, 200);
    return ctx.listScans.execute(id, limit);
  });
}
