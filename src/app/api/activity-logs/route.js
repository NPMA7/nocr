import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { filterFlappingLogs } from '@/lib/logUtils';

export async function GET() {
  try {
    // Mengambil data dari tabel activity_logs
    // Mengurutkan berdasarkan kolom 'time' dari yang paling baru (descending)
    const { data: logs, error } = await db
      .from('activity_logs')
      .select('*')
      .order('time', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    console.error('Gagal mengambil data log dari database:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}