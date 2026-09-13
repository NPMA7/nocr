"use client";

export default function CoreResourceCard({
  icon: Icon,
  iconColorClass = "text-sky-400",
  title,
  value,
  subValue,
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 md:p-3 flex flex-col justify-between hover:border-slate-700/80 transition duration-200">
      <div className="flex items-center justify-between gap-1.5 text-slate-400 mb-1">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={iconColorClass} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            {title}
          </span>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-base md:text-lg font-bold font-mono text-slate-100 truncate">
          {value || "--"}
        </span>
        {subValue && (
          <span className="text-[10px] text-slate-400 font-mono">{subValue}</span>
        )}
      </div>
    </div>
  );
}
