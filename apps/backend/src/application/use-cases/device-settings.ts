import type { UpdateDeviceSettingsInput } from "@iot/shared";
import type { DeviceDTO } from "@iot/shared";
import { computeNextAnalysis } from "../../domain/analysis-policy.js";
import type { Device } from "../../domain/entities.js";
import type {
  AnalysisJobs,
  DeviceRepository,
  EventPublisher,
  FrameStore,
} from "../../domain/ports.js";
import { toDeviceDTO } from "../mappers.js";

export interface DeviceQueryDeps {
  devices: DeviceRepository;
  frames: FrameStore;
  staleFactor: number;
  publisher: EventPublisher;
}

export class ListDevicesUseCase {
  constructor(private readonly deps: DeviceQueryDeps) {}

  async execute(): Promise<DeviceDTO[]> {
    const devices = await this.deps.devices.findAll();
    const now = Date.now();
    const result: DeviceDTO[] = [];
    for (const device of devices) {
      const frame = await this.deps.frames.get(device.id);
      const online = this.isOnline(device, frame?.at ?? null, now);
      result.push(toDeviceDTO(device, online));
    }
    return result;
  }

  private isOnline(
    device: Device,
    frameAt: Date | null,
    now: number,
  ): boolean {
    if (!frameAt) return false;
    const maxAgeMs =
      device.analysisIntervalMinutes * this.deps.staleFactor * 60_000;
    return now - frameAt.getTime() <= maxAgeMs;
  }
}

export class UpdateDeviceSettingsUseCase {
  constructor(private readonly deps: DeviceQueryDeps) {}

  async execute(
    deviceId: string,
    patch: UpdateDeviceSettingsInput,
  ): Promise<DeviceDTO | null> {
    const current = await this.deps.devices.findById(deviceId);
    if (!current) return null;

    const update: Parameters<DeviceRepository["update"]>[1] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.active !== undefined) update.active = patch.active;
    if (patch.analysisIntervalMinutes !== undefined) {
      update.analysisIntervalMinutes = patch.analysisIntervalMinutes;
      update.nextAnalysisAt = computeNextAnalysis(
        new Date(),
        patch.analysisIntervalMinutes,
      );
    }

    const updated = await this.deps.devices.update(deviceId, update);
    if (!updated) return null;

    const dto = toDeviceDTO(updated, true);
    await this.deps.publisher.publish({
      type: "device.updated",
      payload: dto,
    });
    return dto;
  }
}

export class RequestAnalysisNowUseCase {
  constructor(private readonly jobs: AnalysisJobs) {}

  async execute(deviceId: string): Promise<void> {
    await this.jobs.enqueueNow(deviceId);
  }
}
