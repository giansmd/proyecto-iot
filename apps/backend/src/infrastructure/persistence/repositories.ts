import type { AlertStatus } from "@iot/shared";
import { and, desc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  Alert,
  Device,
  Scan,
  UsageTotals,
} from "../../domain/entities.js";
import type {
  AlertRepository,
  DeviceRepository,
  NewAlert,
  NewScan,
  NewUsage,
  ScanRepository,
  UsageRepository,
} from "../../domain/ports.js";
import type { Database } from "./db.js";
import { aiUsage, alerts, devices, scans } from "./schema.js";

export class DrizzleDeviceRepository implements DeviceRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Device[]> {
    const rows = await this.db.select().from(devices).orderBy(devices.id);
    return rows;
  }

  async findById(id: string): Promise<Device | null> {
    const rows = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async ensureDevice(
    id: string,
    defaults: {
      name: string;
      analysisIntervalMinutes: number;
      captureIntervalSeconds: number;
      nextAnalysisAt: Date;
    },
  ): Promise<Device> {
    await this.db
      .insert(devices)
      .values({
        id,
        name: defaults.name,
        analysisIntervalMinutes: defaults.analysisIntervalMinutes,
        captureIntervalSeconds: defaults.captureIntervalSeconds,
        nextAnalysisAt: defaults.nextAnalysisAt,
      })
      .onConflictDoNothing({ target: devices.id });

    const device = await this.findById(id);
    if (!device) throw new Error(`No se pudo asegurar el dispositivo ${id}`);
    return device;
  }

  async findDue(now: Date): Promise<Device[]> {
    return this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.active, true),
          or(isNull(devices.nextAnalysisAt), lte(devices.nextAnalysisAt, now)),
        ),
      );
  }

  async update(
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
  ): Promise<Device | null> {
    const rows = await this.db
      .update(devices)
      .set(patch)
      .where(eq(devices.id, id))
      .returning();
    return rows[0] ?? null;
  }
}

export class DrizzleScanRepository implements ScanRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewScan): Promise<Scan> {
    const rows = await this.db
      .insert(scans)
      .values({
        deviceId: input.deviceId,
        subjectVisible: input.subjectVisible,
        emptyDetected: input.emptyDetected,
        confidence: input.confidence,
        description: input.description,
        emptyAreas: input.emptyAreas,
        frameHash: input.frameHash,
        analyzedAt: input.analyzedAt,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("No se pudo crear el scan");
    return row;
  }

  async findLatestByDevice(deviceId: string): Promise<Scan | null> {
    const rows = await this.db
      .select()
      .from(scans)
      .where(eq(scans.deviceId, deviceId))
      .orderBy(desc(scans.analyzedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByDevice(deviceId: string, limit: number): Promise<Scan[]> {
    return this.db
      .select()
      .from(scans)
      .where(eq(scans.deviceId, deviceId))
      .orderBy(desc(scans.analyzedAt))
      .limit(limit);
  }
}

export class DrizzleAlertRepository implements AlertRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewAlert): Promise<Alert> {
    const rows = await this.db
      .insert(alerts)
      .values({
        deviceId: input.deviceId,
        scanId: input.scanId,
        description: input.description,
        confidence: input.confidence,
        createdAt: input.createdAt,
      })
      .returning();
    const row = rows[0];
    if (!row) throw new Error("No se pudo crear la alerta");
    return row;
  }

  async findActiveByDevice(deviceId: string): Promise<Alert | null> {
    const rows = await this.db
      .select()
      .from(alerts)
      .where(
        and(eq(alerts.deviceId, deviceId), ne(alerts.status, "resolved")),
      )
      .orderBy(desc(alerts.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: number): Promise<Alert | null> {
    const rows = await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(status?: AlertStatus, limit = 100): Promise<Alert[]> {
    const base = this.db.select().from(alerts);
    const rows = status
      ? await base.where(eq(alerts.status, status)).orderBy(desc(alerts.createdAt)).limit(limit)
      : await base.orderBy(desc(alerts.createdAt)).limit(limit);
    return rows;
  }

  async updateStatus(
    id: number,
    status: AlertStatus,
    at: Date,
  ): Promise<Alert | null> {
    const patch: Partial<typeof alerts.$inferInsert> = { status };
    if (status === "ack") patch.acknowledgedAt = at;
    if (status === "resolved") patch.resolvedAt = at;

    const rows = await this.db
      .update(alerts)
      .set(patch)
      .where(eq(alerts.id, id))
      .returning();
    return rows[0] ?? null;
  }
}

export class DrizzleUsageRepository implements UsageRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewUsage): Promise<void> {
    await this.db.insert(aiUsage).values(input);
  }

  async totals(): Promise<UsageTotals> {
    const rows = await this.db
      .select({
        costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)`,
        calls: sql<number>`count(*)::int`,
        promptTokens: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)::int`,
        completionTokens: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)::int`,
      })
      .from(aiUsage);
    const row = rows[0];
    return {
      costUsd: Number(row?.costUsd ?? 0),
      calls: Number(row?.calls ?? 0),
      promptTokens: Number(row?.promptTokens ?? 0),
      completionTokens: Number(row?.completionTokens ?? 0),
    };
  }
}
