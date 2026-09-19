import type { FrameStore, StoredFrame } from "../../domain/ports.js";

export class GetLatestFrameUseCase {
  constructor(private readonly frames: FrameStore) {}

  async execute(deviceId: string): Promise<StoredFrame | null> {
    return this.frames.get(deviceId);
  }
}
