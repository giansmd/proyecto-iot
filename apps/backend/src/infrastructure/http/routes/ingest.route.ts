import type { IngestResponse } from "@iot/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../../../config.js";
import type { IngestImageUseCase } from "../../../application/use-cases/ingest-image.js";
import { DEVICE_KEY_HEADER, resolveDeviceId } from "../auth.js";

interface IngestContext {
  config: AppConfig;
  ingest: IngestImageUseCase;
}

export function registerIngestRoute(
  app: FastifyInstance,
  ctx: IngestContext,
): void {
  app.post(
    "/analizar-anaquel",
    {
      preHandler: async (
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> => {
        const deviceId = resolveDeviceId(
          ctx.config,
          request.headers[DEVICE_KEY_HEADER],
        );
        if (!deviceId) {
          await reply
            .code(401)
            .send({ accepted: false, reason: "invalid-device-key" });
          return;
        }
        (
          request as FastifyRequest & { deviceId?: string }
        ).deviceId = deviceId;
      },
    },
    async (request, reply) => {
      const deviceId = (request as FastifyRequest & { deviceId?: string })
        .deviceId;
      const image = request.body;
      if (!deviceId || !Buffer.isBuffer(image) || image.length === 0) {
        const body: IngestResponse = {
          accepted: false,
          reason: "expected-jpeg-body",
        };
        return reply.code(400).send(body);
      }

      const result = await ctx.ingest.execute({ deviceId, image });
      return reply.code(result.accepted ? 202 : 400).send(result);
    },
  );
}
