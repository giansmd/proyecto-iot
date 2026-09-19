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

/**
 * Intervalos (en segundos) de captura/envio de imagenes del ESP32.
 * El backend los devuelve en la respuesta de ingesta para que el dispositivo
 * ajuste su ritmo sin reprogramarse.
 */
export const CAPTURE_INTERVAL_PRESETS_SECONDS = [5, 30, 60, 300, 600] as const;
export const DEFAULT_CAPTURE_INTERVAL_SECONDS = 60;
export const MIN_CAPTURE_INTERVAL_SECONDS = 5;
export const MAX_CAPTURE_INTERVAL_SECONDS = 86400;

export const captureIntervalSecondsSchema = z
  .number()
  .int()
  .min(MIN_CAPTURE_INTERVAL_SECONDS)
  .max(MAX_CAPTURE_INTERVAL_SECONDS);

/** Tipo de espacio que el modelo debe analizar en la imagen. */
export const TARGET_TYPES = [
  "anaquel",
  "escritorio",
  "refrigerador",
  "otro",
] as const;
export const targetTypeSchema = z.enum(TARGET_TYPES);
export type TargetType = z.infer<typeof targetTypeSchema>;
export const DEFAULT_TARGET_TYPE: TargetType = "anaquel";

export function targetDescription(type: TargetType, label?: string | null): string {
  const trimmed = label?.trim();
  if (trimmed) return trimmed;
  switch (type) {
    case "anaquel":
      return "anaquel o góndola de tienda";
    case "escritorio":
      return "escritorio de trabajo";
    case "refrigerador":
      return "refrigerador o exhibidor refrigerado";
    default:
      return "espacio vigilado";
  }
}

/** Salida estructurada que debe devolver el modelo de vision. */
export const emptyAreaSchema = z.object({
  level: z.string().max(120),
  detail: z.string().max(300),
  severity: z.enum(["low", "medium", "high"]),
});

export const visionResultSchema = z.object({
  subjectVisible: z.boolean().default(true),
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
  captureIntervalSeconds: number;
  targetType: TargetType;
  targetLabel: string | null;
  lastAnalyzedAt: string | null;
  nextAnalysisAt: string | null;
  createdAt: string;
  online: boolean;
}

export interface ScanDTO {
  id: number;
  deviceId: string;
  subjectVisible: boolean;
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
  analysisIntervalMinutes: analysisIntervalMinutesSchema.optional(),
  captureIntervalSeconds: captureIntervalSecondsSchema.optional(),
  targetType: targetTypeSchema.optional(),
  targetLabel: z.string().max(200).nullable().optional(),
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
  /** Ritmo de captura que el ESP32 debe aplicar en su próximo ciclo. */
  captureIntervalSeconds?: number;
}
