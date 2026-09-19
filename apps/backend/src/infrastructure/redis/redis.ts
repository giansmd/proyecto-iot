import { Redis } from "ioredis";

export function createRedis(url: string): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  client.on("error", (error: Error) => {
    console.error("[redis] error:", error.message);
  });
  return client;
}

export type { Redis };
