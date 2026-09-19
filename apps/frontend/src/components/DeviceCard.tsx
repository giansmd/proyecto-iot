import {
  ANALYSIS_INTERVAL_PRESETS,
  CAPTURE_INTERVAL_PRESETS_SECONDS,
  MAX_ANALYSIS_INTERVAL_MINUTES,
  MAX_CAPTURE_INTERVAL_SECONDS,
  MIN_ANALYSIS_INTERVAL_MINUTES,
  MIN_CAPTURE_INTERVAL_SECONDS,
  TARGET_TYPES,
  type DeviceDTO,
  type ScanDTO,
  type TargetType,
} from "@iot/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatRelative } from "../lib/format";

const FRAME_REFRESH_MS = 5000;

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${seconds} s`;
}

interface DeviceCardProps {
  device: DeviceDTO;
  scan: ScanDTO | null | undefined;
  busy: boolean;
  onIntervalChange: (minutes: number) => void;
  onCaptureIntervalChange: (seconds: number) => void;
  onTargetChange: (targetType: TargetType, targetLabel: string | null) => void;
  onAnalyzeNow: () => void;
}

function statusOf(device: DeviceDTO, scan: ScanDTO | null | undefined) {
  if (!device.online) {
    return { label: "Sin señal", tone: "bg-slate-600 text-slate-100" };
  }
  if (scan && !scan.subjectVisible) {
    return { label: "Sin espacio", tone: "bg-violet-500 text-white" };
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
  onCaptureIntervalChange,
  onTargetChange,
  onAnalyzeNow,
}: DeviceCardProps) {
  const [custom, setCustom] = useState(false);
  const [customValue, setCustomValue] = useState(
    String(device.analysisIntervalMinutes),
  );
  const [customCapture, setCustomCapture] = useState(false);
  const [customCaptureValue, setCustomCaptureValue] = useState(
    String(device.captureIntervalSeconds),
  );
  const [targetLabel, setTargetLabel] = useState(device.targetLabel ?? "");
  const [frameVersion, setFrameVersion] = useState(() => Date.now());
  const [frameError, setFrameError] = useState(false);
  const status = statusOf(device, scan);
  const isPreset = (ANALYSIS_INTERVAL_PRESETS as readonly number[]).includes(
    device.analysisIntervalMinutes,
  );
  const isCapturePreset = (
    CAPTURE_INTERVAL_PRESETS_SECONDS as readonly number[]
  ).includes(device.captureIntervalSeconds);

  useEffect(() => {
    const timer = window.setInterval(
      () => setFrameVersion(Date.now()),
      FRAME_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

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

  const applyCustomCapture = () => {
    const value = Number(customCaptureValue);
    if (
      Number.isInteger(value) &&
      value >= MIN_CAPTURE_INTERVAL_SECONDS &&
      value <= MAX_CAPTURE_INTERVAL_SECONDS
    ) {
      onCaptureIntervalChange(value);
      setCustomCapture(false);
    }
  };

  const applyTargetLabel = () => {
    const next = targetLabel.trim();
    const normalized = next.length > 0 ? next : null;
    if (normalized !== (device.targetLabel ?? null)) {
      onTargetChange(device.targetType, normalized);
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

      <div className="relative h-40 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <img
          src={`${api.frameUrl(device.id)}?t=${frameVersion}`}
          alt={`Vista del anaquel ${device.name}`}
          className={`h-full w-full object-cover transition-opacity ${
            frameError ? "opacity-0" : "opacity-100"
          }`}
          onError={() => setFrameError(true)}
          onLoad={() => setFrameError(false)}
        />
        {frameError ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            Sin imagen del dispositivo
          </div>
        ) : null}
      </div>

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
        <div>
          <dt className="text-slate-500">Espacio visto</dt>
          <dd>{scan ? (scan.subjectVisible ? "Sí" : "No") : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Analiza</dt>
          <dd>{device.targetLabel?.trim() || device.targetType}</dd>
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
          <label className="text-xs text-slate-400">Capturar cada</label>
          <select
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={
              customCapture ? "custom" : String(device.captureIntervalSeconds)
            }
            onChange={(event) => {
              if (event.target.value === "custom") {
                setCustomCapture(true);
                return;
              }
              setCustomCapture(false);
              onCaptureIntervalChange(Number(event.target.value));
            }}
          >
            {CAPTURE_INTERVAL_PRESETS_SECONDS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatSeconds(seconds)}
              </option>
            ))}
            <option value="custom">Personalizado…</option>
          </select>
          {!isCapturePreset && !customCapture ? (
            <span className="text-xs text-slate-400">
              {formatSeconds(device.captureIntervalSeconds)}
            </span>
          ) : null}
        </div>

        {customCapture ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_CAPTURE_INTERVAL_SECONDS}
              max={MAX_CAPTURE_INTERVAL_SECONDS}
              value={customCaptureValue}
              onChange={(event) => setCustomCaptureValue(event.target.value)}
              className="w-24 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            />
            <span className="text-xs text-slate-400">segundos</span>
            <button
              type="button"
              onClick={applyCustomCapture}
              className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500"
            >
              Aplicar
            </button>
          </div>
        ) : null}

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

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Espacio</label>
          <select
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            value={device.targetType}
            onChange={(event) =>
              onTargetChange(
                event.target.value as TargetType,
                device.targetLabel,
              )
            }
          >
            {TARGET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={targetLabel}
            placeholder="descripción (opcional)"
            onChange={(event) => setTargetLabel(event.target.value)}
            onBlur={applyTargetLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyTargetLabel();
            }}
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
          />
        </div>

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
