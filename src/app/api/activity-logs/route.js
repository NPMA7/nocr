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

    const { cleanLogs, flappingIds } = filterFlappingLogs(logs || []);

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