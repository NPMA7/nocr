"use client";

export default function CoreResourceCard({ icon: Icon, iconColorClass, title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3.5 flex flex-col justify-center shadow-xs transition duration-200">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5">
        <Icon size={14} className={iconColorClass} />
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {title}
        </span>
      </div>
      <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
        {value || "--"}
      </span>
    </div>
  );
}
