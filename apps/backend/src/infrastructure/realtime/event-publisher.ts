import type { WsEvent } from "@iot/shared";
import type { EventPublisher } from "../../domain/ports.js";
import type { Redis } from "../redis/redis.js";

export const EVENTS_CHANNEL = "iot:events";

export class RedisEventPublisher implements EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(event: WsEvent): Promise<void> {
    await this.redis.publish(EVENTS_CHANNEL, JSON.stringify(event));
  }
}
