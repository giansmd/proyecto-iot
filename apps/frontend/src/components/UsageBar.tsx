import type { UsageDTO } from "@iot/shared";
import { formatUsd } from "../lib/format";

export function UsageBar({ usage }: { usage: UsageDTO | null }) {
  if (!usage) return null;
  const pct =
    usage.budgetUsd > 0
      ? Math.min(100, (usage.spentUsd / usage.budgetUsd) * 100)
      : 0;
  const tone = usage.blocked
    ? "bg-red-500"
    : pct > 70
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="w-full max-w-md">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>
          Presupuesto IA: {formatUsd(usage.spentUsd)} / {formatUsd(usage.budgetUsd)}
        </span>
        <span>
          {usage.calls} llamadas · restante {formatUsd(usage.remainingUsd)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {usage.blocked ? (
        <p className="mt-1 text-xs text-red-400">
          Presupuesto agotado: análisis de IA pausado.
        </p>
      ) : null}
    </div>
  );
}
