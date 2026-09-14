'use client';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function UptimeTimer({ dateString, prefix = '', suffix = '', mode = 'duration' }) {
  const [timeStr, setTimeStr] = useState('');
  const [localMode, setLocalMode] = useState(mode);

  useEffect(() => {
    setLocalMode(mode);
  }, [mode]);

  const cleanDateString = dateString ? dateString.replace(/\s*\(.*\)\s*$/, '').trim() : '';
  const parsedDate = cleanDateString ? new Date(cleanDateString.replace(' ', 'T') + '+07:00') : null;
  const isValidDate = parsedDate && !isNaN(parsedDate.getTime());

  useEffect(() => {
    if (!cleanDateString) return;

    const updateTimer = () => {
      const now = new Date();
      // If parsedDate is invalid, fallback
      if (!isValidDate) {
        setTimeStr(dateString);
        return;
      }
      
      const diffMs = now - parsedDate;
      if (diffMs < 0) {
        setTimeStr('Baru saja');
        return;
      }

      const diffSecs = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSecs / (3600 * 24));
      const hours = Math.floor((diffSecs % (3600 * 24)) / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);

      let str = [];
      if (days > 0) str.push(`${days}h`);
      if (hours > 0) str.push(`${hours}j`);
      str.push(`${mins}m`);
      
      setTimeStr(str.join(' '));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [cleanDateString, isValidDate, dateString]);

  if (!timeStr) return null;

  const handleToggle = (e) => {
    e.stopPropagation();
    setLocalMode(prev => prev === 'duration' ? 'timestamp' : 'duration');
  };

  const displayText = (localMode === 'timestamp' && isValidDate)
    ? `sejak ${cleanDateString}`
    : (localMode === 'timestamp' ? cleanDateString : timeStr);

  return (
    <span 
      onClick={handleToggle}
      className="text-[10px] text-slate-400 dark:text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer select-none transition-colors"
      style={{ color: 'var(--color-text-muted, #9C9DA1)' }}
      title="Klik untuk mengubah format waktu"
    >
      <Clock size={10} className="shrink-0" style={{ color: 'inherit' }} />
      <span>{prefix} {displayText} {suffix}</span>
    </span>
  );
}
