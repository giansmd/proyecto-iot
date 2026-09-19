import {
  computeNextAnalysis,
  hashFrame,
  isFrameStale,
} from "../../domain/analysis-policy.js";
import type {
  AlertRepository,
  DeviceRepository,
  EventPublisher,
  FrameStore,
  ScanRepository,
  UsageRepository,
  VisionAnalyzer,
} from "../../domain/ports.js";
import { toAlertDTO, toScanDTO } from "../mappers.js";

export type AnalyzeStatus = "analyzed" | "skipped" | "blocked";

export interface AnalyzeDeviceDeps {
  devices: DeviceRepository;
  scans: ScanRepository;
  alerts: AlertRepository;
  frames: FrameStore;
  usage: UsageRepository;
  vision: VisionAnalyzer;
  publisher: EventPublisher;
  budgetUsd: number;
  staleFactor: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export interface AnalyzeDeviceResult {
  status: AnalyzeStatus;
  reason: string;
}

export class AnalyzeDeviceUseCase {
  constructor(private readonly deps: AnalyzeDeviceDeps) {}

  async execute(deviceId: string): Promise<AnalyzeDeviceResult> {
    const device = await this.deps.devices.findById(deviceId);
    if (!device) return { status: "skipped", reason: "unknown-device" };
    if (!device.active) return { status: "skipped", reason: "inactive" };

    const now = new Date();

    // Reprograma el proximo analisis con el intervalo vigente del dispositivo.
    await this.deps.devices.update(deviceId, {
      nextAnalysisAt: computeNextAnalysis(now, device.analysisIntervalMinutes),
    });

    const frame = await this.deps.frames.get(deviceId);
    if (!frame) return { status: "skipped", reason: "no-frame" };
    if (
      isFrameStale(
        frame.at,
        device.analysisIntervalMinutes,
        this.deps.staleFactor,
        now,
      )
    ) {
      return { status: "skipped", reason: "stale-frame" };
    }

    const frameHash = hashFrame(frame.data);
    const latest = await this.deps.scans.findLatestByDevice(deviceId);
    if (latest?.frameHash === frameHash) {
      return { status: "skipped", reason: "unchanged" };
    }

    const totals = await this.deps.usage.totals();
    if (totals.costUsd >= this.deps.budgetUsd) {
      await this.deps.publisher.publish({
        type: "budget.warning",
        payload: {
          spentUsd: totals.costUsd,
          budgetUsd: this.deps.budgetUsd,
          message: "Presupuesto de IA agotado; analisis pausado.",
        },
      });
      return { status: "blocked", reason: "budget" };
    }

    const { result, usage } = await this.deps.vision.analyze({
      image: frame.data,
      target: {
        targetType: device.targetType,
        targetLabel: device.targetLabel,
      },
    });

    const costUsd =
      (usage.promptTokens / 1_000_000) * this.deps.inputPricePer1M +
      (usage.completionTokens / 1_000_000) * this.deps.outputPricePer1M;

    await this.deps.usage.create({
      deviceId,
      model: this.deps.vision.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      costUsd,
      createdAt: now,
    });

    const scan = await this.deps.scans.create({
      deviceId,
      subjectVisible: result.subjectVisible,
      emptyDetected: result.emptyDetected,
      confidence: result.confidence,
      description: result.description,
      emptyAreas: result.emptyAreas,
      frameHash,
      analyzedAt: now,
    });

    await this.deps.devices.update(deviceId, { lastAnalyzedAt: now });
    await this.deps.publisher.publish({
      type: "scan.updated",
      payload: toScanDTO(scan),
    });

    if (result.subjectVisible && result.emptyDetected) {
      const active = await this.deps.alerts.findActiveByDevice(deviceId);
      if (!active) {
        const alert = await this.deps.alerts.create({
          deviceId,
          scanId: scan.id,
          description: result.description,
          confidence: result.confidence,
          createdAt: now,
        });
        await this.deps.publisher.publish({
          type: "alert.created",
          payload: toAlertDTO(alert),
        });
      }
    }

    return {
      status: "analyzed",
      reason: result.emptyDetected ? "empty" : "ok",
    };
  }
}
