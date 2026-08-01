"use client";

export default function StatCard({ icon: Icon, iconColorClass, title, value, isAlert = false }) {
  return (
    <div
      className={`bg-white dark:bg-slate-800/90 border rounded-xl p-3.5 flex flex-col justify-center shadow-xs hover:-translate-y-0.5 transition duration-300 relative overflow-hidden ${
        isAlert && Number(value) > 0
          ? "border-red-300 dark:border-red-500/40 bg-red-50/30 dark:bg-slate-800/90"
          : "border-slate-200 dark:border-slate-700/50"
      }`}
    >
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
        <Icon size={14} className={iconColorClass} />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <span
        className={`text-lg font-extrabold ${
          isAlert && Number(value) > 0
            ? "text-red-600 dark:text-red-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value !== undefined && value !== null ? value : 0}
      </span>
    </div>
  );
}
