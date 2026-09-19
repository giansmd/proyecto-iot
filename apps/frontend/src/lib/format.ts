export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const past = diffMs >= 0;
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return past ? `hace ${minutes} min` : `en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return past ? `hace ${hours} h` : `en ${hours} h`;
  const days = Math.round(hours / 24);
  return past ? `hace ${days} d` : `en ${days} d`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}
