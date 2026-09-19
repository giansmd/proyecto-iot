import { createHash } from "node:crypto";

export function hashFrame(data: Buffer): string {
  return createHash("sha1").update(data).digest("hex");
}

export function computeNextAnalysis(
  from: Date,
  intervalMinutes: number,
): Date {
  return new Date(from.getTime() + intervalMinutes * 60_000);
}

export function isFrameStale(
  frameAt: Date,
  intervalMinutes: number,
  factor: number,
  now: Date = new Date(),
): boolean {
  const maxAgeMs = intervalMinutes * factor * 60_000;
  return now.getTime() - frameAt.getTime() > maxAgeMs;
}
