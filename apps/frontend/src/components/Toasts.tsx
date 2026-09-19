export interface Toast {
  id: number;
  kind: "info" | "warning" | "error" | "success";
  message: string;
}

const TONE: Record<Toast["kind"], string> = {
  info: "border-sky-500/50 bg-sky-950/90 text-sky-100",
  warning: "border-amber-500/50 bg-amber-950/90 text-amber-100",
  error: "border-red-500/50 bg-red-950/90 text-red-100",
  success: "border-emerald-500/50 bg-emerald-950/90 text-emerald-100",
};

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismiss(toast.id)}
          className={`pointer-events-auto rounded-xl border p-3 text-left text-sm shadow-xl ${TONE[toast.kind]}`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
