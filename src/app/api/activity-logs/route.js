import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { filterFlappingLogs } from '@/lib/logUtils';
import { verifyAuth, sendApiError } from '@/lib/auth';

export async function GET(req) {
  try {
    verifyAuth(req);
    // Mengambil data dari tabel activity_logs
    // Mengurutkan berdasarkan kolom 'time' dari yang paling baru (descending)
    const { data: logs, error } = await db
      .from('activity_logs')
      .select('*')
      .order('time', { ascending: false })
      .limit(100);

    if (error) {
      return sendApiError(error);
    }

    const isTopologyNoiseLog = (msg = '') => {
      const lower = msg.toLowerCase();
      return (
        lower.includes('tata letak topologi') ||
        lower.includes('node topologi') ||
        lower.includes('peta topologi')
      );
    };

    const topologyNoiseIds = (logs || [])
      .filter((log) => isTopologyNoiseLog(log.message))
      .map((log) => log.id);

    if (topologyNoiseIds.length > 0) {
      db.from('activity_logs')
        .delete()
        .in('id', topologyNoiseIds)
        .catch(() => {});
    }

    const filteredLogs = (logs || []).filter(
      (log) => !isTopologyNoiseLog(log.message)
    );

    const { cleanLogs, flappingIds } = filterFlappingLogs(filteredLogs);

    // Hapus ID flapping yang terdeteksi dari DB secara asinkron (background)
    if (flappingIds && flappingIds.length > 0) {
      db.from('activity_logs')
        .delete()
        .in('id', flappingIds)
        .catch((err) => {
          console.error('Gagal membersihkan log flapping dari DB:', err.message);
        });
    }

    return NextResponse.json(cleanLogs);
  } catch (error) {
    return sendApiError(error);
  }
}