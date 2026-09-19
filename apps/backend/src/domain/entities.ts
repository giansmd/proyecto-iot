import type { AlertStatus, EmptyArea } from "@iot/shared";

export interface Device {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  analysisIntervalMinutes: number;
  lastAnalyzedAt: Date | null;
  nextAnalysisAt: Date | null;
  createdAt: Date;
}

export interface Scan {
  id: number;
  deviceId: string;
  emptyDetected: boolean;
  confidence: number;
  description: string;
  emptyAreas: EmptyArea[];
  frameHash: string | null;
  analyzedAt: Date;
}

export interface Alert {
  id: number;
  deviceId: string;
  scanId: number;
  status: AlertStatus;
  description: string;
  confidence: number;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export interface AiUsage {
  id: number;
  deviceId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  createdAt: Date;
}

export interface UsageTotals {
  costUsd: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
}
