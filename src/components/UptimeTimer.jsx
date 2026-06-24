'use client';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function UptimeTimer({ dateString, prefix = '', suffix = '' }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (!dateString) return;

    // Remove "(Online)", "(Offline)", "(Reboot)" etc from dateString to parse it correctly
    const cleanDateString = dateString.replace(/\s*\(.*\)\s*$/, '').trim();
    // Assuming format "YYYY-MM-DD HH:mm:ss"
    const parsedDate = new Date(cleanDateString.replace(' ', 'T') + '+07:00'); // Assuming WIB (UTC+7) or local time

    const updateTimer = () => {
      const now = new Date();
      // If parsedDate is invalid, fallback
      if (isNaN(parsedDate.getTime())) {
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
  }, [dateString]);

  if (!timeStr) return null;

  return (
    <span className="text-[10px] flex items-center gap-1">
      <Clock size={10} />
      {prefix} {timeStr} {suffix}
    </span>
  );
}
