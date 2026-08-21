"use client";

export default function CoreResourceCard({ icon: Icon, iconColorClass, title, value }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2.5 md:p-3 flex flex-col justify-center shadow-xs transition duration-200">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1">
        <Icon size={13} className={iconColorClass} />
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {title}
        </span>
      </div>
      <span className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
        {value || "--"}
      </span>
    </div>
  );
}
