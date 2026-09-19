import type { FastifyInstance } from "fastify";
import type { GetUsageUseCase } from "../../../application/use-cases/usage.js";

export function registerUsageRoute(
  app: FastifyInstance,
  getUsage: GetUsageUseCase,
): void {
  app.get("/api/usage", async () => getUsage.execute());
}
