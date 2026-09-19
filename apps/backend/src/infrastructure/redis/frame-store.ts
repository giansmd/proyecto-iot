import type { FrameStore, StoredFrame } from "../../domain/ports.js";
import type { Redis } from "../redis/redis.js";

export class RedisFrameStore implements FrameStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
  ) {}

  private dataKey(deviceId: string): string {
    return `frame:${deviceId}`;
  }

  private timeKey(deviceId: string): string {
    return `frame:${deviceId}:at`;
  }

  async save(deviceId: string, data: Buffer, at: Date): Promise<void> {
    await this.redis
      .multi()
      .set(this.dataKey(deviceId), data, "EX", this.ttlSeconds)
      .set(this.timeKey(deviceId), at.toISOString(), "EX", this.ttlSeconds)
      .exec();
  }

  async get(deviceId: string): Promise<StoredFrame | null> {
    const [data, at] = await Promise.all([
      this.redis.getBuffer(this.dataKey(deviceId)),
      this.redis.get(this.timeKey(deviceId)),
    ]);
    if (!data || !at) return null;
    return { data, at: new Date(at) };
  }
}
