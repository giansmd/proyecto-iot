import type {
  AlertDTO,
  DeviceDTO,
  ScanDTO,
  UsageDTO,
  WsEvent,
} from "@iot/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertPanel } from "./components/AlertPanel";
import { DeviceCard } from "./components/DeviceCard";
import { Toasts, type Toast } from "./components/Toasts";
import { UsageBar } from "./components/UsageBar";
import { api } from "./lib/api";
import { useLiveEvents } from "./lib/useLiveEvents";

export default function App() {
  const [devices, setDevices] = useState<DeviceDTO[]>([]);
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [usage, setUsage] = useState<UsageDTO | null>(null);
  const [scans, setScans] = useState<Record<string, ScanDTO | null>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busyDevice, setBusyDevice] = useState<string | null>(null);
  const [busyAlert, setBusyAlert] = useState<number | null>(null);
  const toastId = useRef(0);

  const pushToast = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = ++toastId.current;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 6000);
    },
    [],
  );

  const loadScans = useCallback(async (list: DeviceDTO[]) => {
    const entries = await Promise.all(
      list.map(async (device) => {
        try {
          const rows = await api.scans(device.id, 1);
          return [device.id, rows[0] ?? null] as const;
        } catch {
          return [device.id, null] as const;
        }
      }),
    );
    setScans(Object.fromEntries(entries));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [deviceList, alertList, usageData] = await Promise.all([
        api.devices(),
        api.alerts(),
        api.usage(),
      ]);
      setDevices(deviceList);
      setAlerts(alertList);
      setUsage(usageData);
      await loadScans(deviceList);
    } catch (error) {
      pushToast("error", `Error al cargar datos: ${String(error)}`);
    }
  }, [loadScans, pushToast]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useLiveEvents((event: WsEvent) => {
    switch (event.type) {
      case "scan.updated":
        setScans((current) => ({
          ...current,
          [event.payload.deviceId]: event.payload,
        }));
        setDevices((current) =>
          current.map((device) =>
            device.id === event.payload.deviceId
              ? { ...device, lastAnalyzedAt: event.payload.analyzedAt }
              : device,
          ),
        );
        break;
      case "alert.created":
        setAlerts((current) => [
          event.payload,
          ...current.filter((alert) => alert.id !== event.payload.id),
        ]);
        pushToast(
          "warning",
          `Anaquel vacío en ${event.payload.deviceId}: ${event.payload.description}`,
        );
        break;
      case "alert.resolved":
        setAlerts((current) =>
          current.map((alert) =>
            alert.id === event.payload.id ? event.payload : alert,
          ),
        );
        break;
      case "device.updated":
        setDevices((current) =>
          current.map((device) =>
            device.id === event.payload.id ? event.payload : device,
          ),
        );
        break;
      case "budget.warning":
        pushToast(
          "error",
          `${event.payload.message} (gastado $${event.payload.spentUsd.toFixed(4)} de $${event.payload.budgetUsd})`,
        );
        void api.usage().then(setUsage).catch(() => undefined);
        break;
    }
  });

  const handleInterval = async (deviceId: string, minutes: number) => {
    try {
      const updated = await api.updateSettings(deviceId, {
        analysisIntervalMinutes: minutes,
      });
      setDevices((current) =>
        current.map((device) => (device.id === deviceId ? updated : device)),
      );
      pushToast("success", `Intervalo actualizado a ${minutes} min.`);
    } catch (error) {
      pushToast("error", `No se pudo actualizar: ${String(error)}`);
    }
  };

  const handleAnalyzeNow = async (deviceId: string) => {
    setBusyDevice(deviceId);
    try {
      await api.analyzeNow(deviceId);
      pushToast("info", "Análisis encolado; se procesará en breve.");
    } catch (error) {
      pushToast("error", `No se pudo encolar: ${String(error)}`);
    } finally {
      setBusyDevice(null);
    }
  };

  const handleAlertAction = async (id: number, action: "ack" | "resolve") => {
    setBusyAlert(id);
    try {
      const updated =
        action === "ack" ? await api.ackAlert(id) : await api.resolveAlert(id);
      setAlerts((current) =>
        current.map((alert) => (alert.id === id ? updated : alert)),
      );
    } catch (error) {
      pushToast("error", `No se pudo actualizar la alerta: ${String(error)}`);
    } finally {
      setBusyAlert(null);
    }
  };

  const openAlerts = alerts.filter((alert) => alert.status !== "resolved");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">
            Monitor de Anaqueles IoT
          </h1>
          <p className="text-sm text-slate-400">
            Detección de espacios vacíos con IA · actualizaciones en vivo
          </p>
        </div>
        <UsageBar usage={usage} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-4 sm:grid-cols-2">
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay dispositivos. Cuando el ESP32 envíe su primera imagen
              aparecerá aquí.
            </p>
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                scan={scans[device.id]}
                busy={busyDevice === device.id}
                onIntervalChange={(minutes) =>
                  void handleInterval(device.id, minutes)
                }
                onAnalyzeNow={() => void handleAnalyzeNow(device.id)}
              />
            ))
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <AlertPanel
            alerts={openAlerts}
            busyId={busyAlert}
            onAck={(id) => void handleAlertAction(id, "ack")}
            onResolve={(id) => void handleAlertAction(id, "resolve")}
          />
        </aside>
      </div>

      <Toasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((current) => current.filter((toast) => toast.id !== id))
        }
      />
    </div>
  );
}
