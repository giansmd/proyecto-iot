import type { AlertDTO, AlertStatus, ScanDTO } from "@iot/shared";
import type {
  AlertRepository,
  EventPublisher,
  ScanRepository,
} from "../../domain/ports.js";
import { toAlertDTO, toScanDTO } from "../mappers.js";

export class ListAlertsUseCase {
  constructor(private readonly alerts: AlertRepository) {}

  async execute(status?: AlertStatus): Promise<AlertDTO[]> {
    const rows = await this.alerts.list(status, 200);
    return rows.map(toAlertDTO);
  }
}

export class AlertActionUseCase {
  constructor(
    private readonly alerts: AlertRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(
    id: number,
    action: "ack" | "resolve",
  ): Promise<AlertDTO | null> {
    const status: AlertStatus = action === "ack" ? "ack" : "resolved";
    const updated = await this.alerts.updateStatus(id, status, new Date());
    if (!updated) return null;

    const dto = toAlertDTO(updated);
    if (status === "resolved") {
      await this.publisher.publish({ type: "alert.resolved", payload: dto });
    }
    return dto;
  }
}

export class ListScansUseCase {
  constructor(private readonly scans: ScanRepository) {}

  async execute(deviceId: string, limit: number): Promise<ScanDTO[]> {
    const rows = await this.scans.listByDevice(deviceId, limit);
    return rows.map(toScanDTO);
  }
}
