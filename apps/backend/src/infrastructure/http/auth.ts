import type { AppConfig } from "../../config.js";

export const DEVICE_KEY_HEADER = "x-device-key";

export function resolveDeviceId(
  config: AppConfig,
  header: string | string[] | undefined,
): string | null {
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) return null;
  return config.deviceKeys.get(key) ?? null;
}
