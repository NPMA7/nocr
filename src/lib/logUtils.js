const fs = require('fs');
const path = require('path');

/**
 * Membaca batas waktu (threshold) flapping dalam milidetik dari data/server-settings.json
 * @returns {number} milidetik
 */
function getFlappingThresholdMs() {
  try {
    const cwd = process.cwd ? process.cwd() : __dirname;
    const settingsPath = path.join(cwd, 'data', 'server-settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      const mins = settings.activity_log_flapping_minutes ?? settings.min_offline_duration_minutes ?? 10;
      return mins * 60 * 1000;
    }
  } catch (e) {
    // Fallback default ke 10 menit jika gagal membaca file
  }
  return 10 * 60 * 1000;
}

/**
 * Mendapatkan informasi target dan status dari pesan log jika berupa perubahan status
 * @param {string} message 
 * @returns {{ targetName: string, status: string } | null}
 */
function getStatusLogInfo(message) {
  if (!message || typeof message !== 'string') return null;
  // Match formats:
  // "Status DAMKAR-COMAND_CENTER berubah menjadi Offline"
  // "Status pelanggan FO-123 berubah menjadi Online"
  // "Status perangkat Core-SW berubah menjadi Offline"
  const match = message.match(/^Status\s+(?:(?:pelanggan|perangkat)\s+)?(.+?)\s+berubah menjadi\s+(Online|Offline)$/i);
  if (!match) return null;
  return {
    targetName: match[1].trim().toUpperCase(),
    status: match[2].toLowerCase()
  };
}

/**
 * Menyaring log aktivitas dan mengidentifikasi log flapping (sesuai threshold di server-settings.json)
 * @param {Array} logs - Array objek log aktivitas { id, time, message }
 * @param {number} [thresholdMs] - Batas durasi flapping dalam milidetik (opsional, default dibaca dari server-settings.json)
 * @returns {{ cleanLogs: Array, flappingIds: Array<number|string> }}
 */
function filterFlappingLogs(logs, thresholdMs) {
  if (thresholdMs == null) {
    thresholdMs = getFlappingThresholdMs();
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return { cleanLogs: [], flappingIds: [] };
  }

  const targetGroups = {};
  const nonStatusLogs = [];
  const statusLogs = [];

  logs.forEach((log) => {
    const info = getStatusLogInfo(log.message || log.msg);
    if (info) {
      const item = {
        ...log,
        _targetName: info.targetName,
        _status: info.status,
        _timeMs: new Date(log.time).getTime()
      };
      statusLogs.push(item);
      if (!targetGroups[info.targetName]) {
        targetGroups[info.targetName] = [];
      }
      targetGroups[info.targetName].push(item);
    } else {
      nonStatusLogs.push(log);
    }
  });

  const flappingIds = new Set();

  Object.keys(targetGroups).forEach((targetName) => {
    const group = targetGroups[targetName];
    // Urutkan secara kronologis dari yang terlama ke terbaru (ascending time)
    group.sort((a, b) => a._timeMs - b._timeMs);

    for (let i = 0; i < group.length; i++) {
      const prev = i > 0 ? group[i - 1] : null;
      const next = i < group.length - 1 ? group[i + 1] : null;

      const isFlappingWithPrev = prev && (group[i]._timeMs - prev._timeMs < thresholdMs);
      const isFlappingWithNext = next && (next._timeMs - group[i]._timeMs < thresholdMs);

      if (isFlappingWithPrev || isFlappingWithNext) {
        group[i]._flapping = true;
        if (group[i].id != null) {
          flappingIds.add(group[i].id);
        }
      }
    }
  });

  const cleanStatusLogs = statusLogs
    .filter((log) => !log._flapping)
    .map((log) => {
      const { _targetName, _status, _timeMs, _flapping, ...rest } = log;
      return rest;
    });

  const allClean = [...nonStatusLogs, ...cleanStatusLogs];
  // Urutkan kembali dari yang paling baru ke terlama (descending time)
  allClean.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { cleanLogs: allClean, flappingIds: Array.from(flappingIds) };
}

module.exports = {
  getStatusLogInfo,
  filterFlappingLogs,
  getFlappingThresholdMs
};

