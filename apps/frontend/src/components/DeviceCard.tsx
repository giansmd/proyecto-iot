import {
  ANALYSIS_INTERVAL_PRESETS,
  MAX_ANALYSIS_INTERVAL_MINUTES,
  MIN_ANALYSIS_INTERVAL_MINUTES,
  type DeviceDTO,
  type ScanDTO,
} from "@iot/shared";
import { useState } from "react";
import { formatRelative } from "../lib/format";

interface DeviceCardProps {
  device: DeviceDTO;
  scan: ScanDTO | null | undefined;
  busy: boolean;
  onIntervalChange: (minutes: number) => void;
  onAnalyzeNow: () => void;
}

function statusOf(device: DeviceDTO, scan: ScanDTO | null | undefined) {
  if (!device.online) {
    return { label: "Sin señal", tone: "bg-slate-600 text-slate-100" };
  }
  if (scan?.emptyDetected) {
    return { label: "Vacío", tone: "bg-red-500 text-white" };
  }
  if (scan) {
    return { label: "OK", tone: "bg-emerald-500 text-white" };
  }
  return { label: "Sin datos", tone: "bg-amber-500 text-slate-900" };
}

export function DeviceCard({
  device,
  scan,
  busy,
  onIntervalChange,
  onAnalyzeNow,
}: DeviceCardProps) {
  const [custom, setCustom] = useState(false);
  const [customValue, setCustomValue] = useState(
    String(device.analysisIntervalMinutes),
  );
  const status = statusOf(device, scan);
  const isPreset = (ANALYSIS_INTERVAL_PRESETS as readonly number[]).includes(
    device.analysisIntervalMinutes,
  );

  const applyCustom = () => {
    const value = Number(customValue);
    if (
      Number.isInteger(value) &&
      value >= MIN_ANALYSIS_INTERVAL_MINUTES &&
      value <= MAX_ANALYSIS_INTERVAL_MINUTES
    ) {
      onIntervalChange(value);
      setCustom(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow-lg">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">{device.name}</h3>
          <p className="text-xs text-slate-400">
            {device.location ?? "Sin ubicación"} · {device.id}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.tone}`}
        >
          {status.label}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs text-slate-300">
        <div>
          <dt className="text-slate-500">Último análisis</dt>
          <dd>{formatRelative(device.lastAnalyzedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Próximo análisis</dt>
          <dd>{formatRelative(device.nextAnalysisAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Confianza</dt>
          <dd>{scan ? `${Math.round(scan.confidence * 100)}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Estado equipo</dt>
          <dd>{device.online ? "En línea" : "Desconectado"}</dd>
        </div>
      </dl>

      {scan?.description ? (
        <p className="rounded-lg bg-slate-800/80 p-2 text-xs text-slate-200">
          {scan.description}
        </p>
      ) : null}

      {scan?.emptyAreas?.length ? (
        <ul className="flex flex-col gap-1 text-xs text-red-300">
          {scan.emptyAreas.map((area, index) => (
            <li key={`${area.level}-${index}`}>
              • {area.level}: {area.detail} ({area.severity})
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="mt-auto flex flex-col gap-2 border-t border-slate-800 pt-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Analizar cada</label>
          <select
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={custom ? "custom" : String(device.analysisIntervalMinutes)}
            onChange={(event) => {
              if (event.target.value === "custom") {
                setCustom(true);
                return;
              }
              setCustom(false);
              onIntervalChange(Number(event.target.value));
            }}
          >
            {ANALYSIS_INTERVAL_PRESETS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
              </option>
            ))}
            <option value="custom">Personalizado…</option>
          </select>
          {!isPreset && !custom ? (
            <span className="text-xs text-slate-400">
              {device.analysisIntervalMinutes} min
            </span>
          ) : null}
        </div>

        {custom ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_ANALYSIS_INTERVAL_MINUTES}
              max={MAX_ANALYSIS_INTERVAL_MINUTES}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="w-24 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            />
            <span className="text-xs text-slate-400">minutos</span>
            <button
              type="button"
              onClick={applyCustom}
              className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500"
            >
              Aplicar
            </button>
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={onAnalyzeNow}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Encolando…" : "Analizar ahora"}
        </button>
      </footer>
    </article>
  );
}
