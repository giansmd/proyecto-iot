import type {
  AlertDTO,
  DeviceDTO,
  ScanDTO,
  UpdateDeviceSettingsInput,
  UsageDTO,
} from "@iot/shared";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} ${text}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  devices: () => request<DeviceDTO[]>("/api/devices"),
  alerts: (status?: string) =>
    request<AlertDTO[]>(`/api/alerts${status ? `?status=${status}` : ""}`),
  scans: (deviceId: string, limit = 10) =>
    request<ScanDTO[]>(`/api/devices/${deviceId}/scans?limit=${limit}`),
  frameUrl: (deviceId: string) =>
    `${BASE}/api/devices/${encodeURIComponent(deviceId)}/frame`,
  usage: () => request<UsageDTO>("/api/usage"),
  updateSettings: (deviceId: string, body: UpdateDeviceSettingsInput) =>
    request<DeviceDTO>(`/api/devices/${deviceId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  analyzeNow: (deviceId: string) =>
    request<{ queued: boolean }>(`/api/devices/${deviceId}/analyze-now`, {
      method: "POST",
    }),
  ackAlert: (id: number) =>
    request<AlertDTO>(`/api/alerts/${id}/ack`, { method: "POST" }),
  resolveAlert: (id: number) =>
    request<AlertDTO>(`/api/alerts/${id}/resolve`, { method: "POST" }),
};

export function wsUrl(): string {
  if (BASE) {
    const url = new URL(BASE, window.location.origin);
    const scheme = url.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${url.host}/ws`;
  }
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}
