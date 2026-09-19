import type {
  AlertStatus,
  TargetType,
  VisionResult,
  WsEvent,
} from "@iot/shared";
import type {
  Alert,
  Device,
  Scan,
  UsageTotals,
} from "./entities.js";

export interface NewScan {
  deviceId: string;
  subjectVisible: boolean;
  emptyDetected: boolean;
  confidence: number;
  description: string;
  emptyAreas: VisionResult["emptyAreas"];
  frameHash: string | null;
  analyzedAt: Date;
}

export interface NewAlert {
  deviceId: string;
  scanId: number;
  description: string;
  confidence: number;
  createdAt: Date;
}

export interface NewUsage {
  deviceId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  createdAt: Date;
}

export interface DeviceRepository {
  findAll(): Promise<Device[]>;
  findById(id: string): Promise<Device | null>;
  /** Inserta el dispositivo si no existe; preserva su configuracion si ya existe. */
  ensureDevice(
    id: string,
    defaults: {
      name: string;
      analysisIntervalMinutes: number;
      captureIntervalSeconds: number;
      nextAnalysisAt: Date;
    },
  ): Promise<Device>;
  findDue(now: Date): Promise<Device[]>;
  update(
    id: string,
    patch: Partial<
      Pick<
        Device,
        | "name"
        | "location"
        | "active"
        | "analysisIntervalMinutes"
        | "captureIntervalSeconds"
        | "targetType"
        | "targetLabel"
        | "lastAnalyzedAt"
        | "nextAnalysisAt"
      >
    >,
  ): Promise<Device | null>;
}

export interface ScanRepository {
  create(input: NewScan): Promise<Scan>;
  findLatestByDevice(deviceId: string): Promise<Scan | null>;
  listByDevice(deviceId: string, limit: number): Promise<Scan[]>;
}

export interface AlertRepository {
  create(input: NewAlert): Promise<Alert>;
  findActiveByDevice(deviceId: string): Promise<Alert | null>;
  findById(id: number): Promise<Alert | null>;
  list(status?: AlertStatus, limit?: number): Promise<Alert[]>;
  updateStatus(
    id: number,
    status: AlertStatus,
    at: Date,
  ): Promise<Alert | null>;
}

export interface UsageRepository {
  create(input: NewUsage): Promise<void>;
  totals(): Promise<UsageTotals>;
}

export interface StoredFrame {
  data: Buffer;
  at: Date;
}

export interface FrameStore {
  save(deviceId: string, data: Buffer, at: Date): Promise<void>;
  get(deviceId: string): Promise<StoredFrame | null>;
}

export interface VisionUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface VisionTarget {
  targetType: TargetType;
  targetLabel: string | null;
}

export interface VisionAnalyzer {
  readonly model: string;
  analyze(input: {
    image: Buffer;
    target: VisionTarget;
  }): Promise<{ result: VisionResult; usage: VisionUsage }>;
}

export interface EventPublisher {
  publish(event: WsEvent): Promise<void>;
}

export interface AnalysisJobs {
  enqueueNow(deviceId: string): Promise<void>;
}
