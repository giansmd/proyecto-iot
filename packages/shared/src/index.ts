import { z } from "zod";

/**
 * Intervalos (en minutos) ofrecidos por el frontend.
 * El usuario tambien puede definir un valor personalizado (1..1440).
 */
export const ANALYSIS_INTERVAL_PRESETS = [1, 5, 30, 60, 120] as const;
export const DEFAULT_ANALYSIS_INTERVAL_MINUTES = 30;
export const MIN_ANALYSIS_INTERVAL_MINUTES = 1;
export const MAX_ANALYSIS_INTERVAL_MINUTES = 1440;

export const analysisIntervalMinutesSchema = z
  .number()
  .int()
  .min(MIN_ANALYSIS_INTERVAL_MINUTES)
  .max(MAX_ANALYSIS_INTERVAL_MINUTES);

/** Salida estructurada que debe devolver el modelo de vision. */
export const emptyAreaSchema = z.object({
  level: z.string().max(120),
  detail: z.string().max(300),
  severity: z.enum(["low", "medium", "high"]),
});

export const visionResultSchema = z.object({
  emptyDetected: z.boolean(),
  confidence: z.number().min(0).max(1),
  description: z.string().max(1000),
  emptyAreas: z.array(emptyAreaSchema).max(50).default([]),
});

export type EmptyArea = z.infer<typeof emptyAreaSchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;

export const alertStatusSchema = z.enum(["open", "ack", "resolved"]);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export interface DeviceDTO {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  analysisIntervalMinutes: number;
  lastAnalyzedAt: string | null;
  nextAnalysisAt: string | null;
  createdAt: string;
  online: boolean;
}

export interface ScanDTO {
  id: number;
  deviceId: string;
  emptyDetected: boolean;
  confidence: number;
  description: string;
  emptyAreas: EmptyArea[];
  analyzedAt: string;
}

export interface AlertDTO {
  id: number;
  deviceId: string;
  scanId: number;
  status: AlertStatus;
  description: string;
  confidence: number;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface UsageDTO {
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  blocked: boolean;
}

export const updateDeviceSettingsSchema = z.object({
  analysisIntervalMinutes: analysisIntervalMinutesSchema,
  location: z.string().max(200).nullable().optional(),
  name: z.string().max(120).optional(),
  active: z.boolean().optional(),
});

export type UpdateDeviceSettingsInput = z.infer<
  typeof updateDeviceSettingsSchema
>;

export const alertActionSchema = z.object({
  action: z.enum(["ack", "resolve"]),
});

export type AlertActionInput = z.infer<typeof alertActionSchema>;

export type WsEvent =
  | { type: "scan.updated"; payload: ScanDTO }
  | { type: "alert.created"; payload: AlertDTO }
  | { type: "alert.resolved"; payload: AlertDTO }
  | { type: "device.updated"; payload: DeviceDTO }
  | {
      type: "budget.warning";
      payload: { spentUsd: number; budgetUsd: number; message: string };
    };

/** Respuesta del endpoint de ingesta (POST /analizar-anaquel). */
export interface IngestResponse {
  accepted: boolean;
  reason?: string;
}
