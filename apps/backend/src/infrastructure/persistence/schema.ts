import type { AlertStatus, EmptyArea } from "@iot/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  active: boolean("active").notNull().default(true),
  analysisIntervalMinutes: integer("analysis_interval_minutes")
    .notNull()
    .default(30),
  lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
  nextAnalysisAt: timestamp("next_analysis_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scans = pgTable("scans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  emptyDetected: boolean("empty_detected").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  description: text("description").notNull(),
  emptyAreas: jsonb("empty_areas")
    .$type<EmptyArea[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  frameHash: text("frame_hash"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  deviceId: text("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  scanId: integer("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  status: text("status").$type<AlertStatus>().notNull().default("open"),
  description: text("description").notNull().default(""),
  confidence: doublePrecision("confidence").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const aiUsage = pgTable("ai_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  deviceId: text("device_id"),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  costUsd: doublePrecision("cost_usd").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
