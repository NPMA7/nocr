import { useState } from "react";

/**
 * Shared toast hook
 * Usage: const { showToast, ToastComponent } = useToast();
 * In JSX: {ToastComponent}
 * Trigger: showToast("message", "error"|"warning"|"success")
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const ToastComponent = toast ? (
    <div
      className={`fixed bottom-5 right-5 z-[9999] flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm max-w-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
        toast.type === "success"
          ? "bg-emerald-900/90 border-emerald-600/50 text-emerald-100"
          : toast.type === "warning"
          ? "bg-yellow-900/90 border-yellow-600/50 text-yellow-100"
          : "bg-red-900/90 border-red-600/50 text-red-100"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {toast.type === "success" ? "✅" : toast.type === "warning" ? "⚠️" : "❌"}
      </span>
      <p className="leading-relaxed">{toast.message}</p>
      <button
        onClick={() => setToast(null)}
        className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition cursor-pointer"
      >✕</button>
    </div>
  ) : null;

  return { showToast, ToastComponent };
}
