import type { AlertDTO } from "@iot/shared";
import { formatRelative } from "../lib/format";

interface AlertPanelProps {
  alerts: AlertDTO[];
  busyId: number | null;
  onAck: (id: number) => void;
  onResolve: (id: number) => void;
}

const STATUS_LABEL: Record<AlertDTO["status"], string> = {
  open: "Abierta",
  ack: "Acusada",
  resolved: "Resuelta",
};

const STATUS_TONE: Record<AlertDTO["status"], string> = {
  open: "bg-red-500/20 text-red-300 border-red-500/40",
  ack: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  resolved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export function AlertPanel({
  alerts,
  busyId,
  onAck,
  onResolve,
}: AlertPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow-lg">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
        Alertas de reposición
      </h2>

      {alerts.length === 0 ? (
        <p className="text-sm text-slate-500">Sin alertas registradas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-100">
                  {alert.deviceId}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[alert.status]}`}
                >
                  {STATUS_LABEL[alert.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{alert.description}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {formatRelative(alert.createdAt)} · confianza{" "}
                {Math.round(alert.confidence * 100)}%
              </p>

              {alert.status !== "resolved" ? (
                <div className="mt-2 flex gap-2">
                  {alert.status === "open" ? (
                    <button
                      type="button"
                      disabled={busyId === alert.id}
                      onClick={() => onAck(alert.id)}
                      className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      Acusar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => onResolve(alert.id)}
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Resolver
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
