import type { AlertDTO, DeviceDTO, ScanDTO } from "@iot/shared";
import type { Alert, Device, Scan } from "../domain/entities.js";

export function toDeviceDTO(device: Device, online: boolean): DeviceDTO {
  return {
    id: device.id,
    name: device.name,
    location: device.location,
    active: device.active,
    analysisIntervalMinutes: device.analysisIntervalMinutes,
    captureIntervalSeconds: device.captureIntervalSeconds,
    targetType: device.targetType,
    targetLabel: device.targetLabel,
    lastAnalyzedAt: device.lastAnalyzedAt?.toISOString() ?? null,
    nextAnalysisAt: device.nextAnalysisAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    online,
  };
}

export function toScanDTO(scan: Scan): ScanDTO {
  return {
    id: scan.id,
    deviceId: scan.deviceId,
    subjectVisible: scan.subjectVisible,
    emptyDetected: scan.emptyDetected,
    confidence: scan.confidence,
    description: scan.description,
    emptyAreas: scan.emptyAreas,
    analyzedAt: scan.analyzedAt.toISOString(),
  };
}

export function toAlertDTO(alert: Alert): AlertDTO {
  return {
    id: alert.id,
    deviceId: alert.deviceId,
    scanId: alert.scanId,
    status: alert.status,
    description: alert.description,
    confidence: alert.confidence,
    createdAt: alert.createdAt.toISOString(),
    acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  };
}
