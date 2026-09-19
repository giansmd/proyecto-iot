import type { IngestResponse } from "@iot/shared";
import { computeNextAnalysis } from "../../domain/analysis-policy.js";
import type { DeviceRepository, FrameStore } from "../../domain/ports.js";

export interface IngestImageDeps {
  devices: DeviceRepository;
  frames: FrameStore;
  defaultIntervalMinutes: number;
}

export class IngestImageUseCase {
  constructor(private readonly deps: IngestImageDeps) {}

  async execute(input: {
    deviceId: string;
    image: Buffer;
  }): Promise<IngestResponse> {
    if (input.image.length === 0) {
      return { accepted: false, reason: "empty-body" };
    }

    const now = new Date();
    await this.deps.devices.ensureDevice(input.deviceId, {
      name: input.deviceId,
      analysisIntervalMinutes: this.deps.defaultIntervalMinutes,
      // El primer analisis ocurre recien al cumplirse el intervalo.
      nextAnalysisAt: computeNextAnalysis(now, this.deps.defaultIntervalMinutes),
    });

    await this.deps.frames.save(input.deviceId, input.image, now);
    return { accepted: true };
  }
}
