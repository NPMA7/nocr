import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';

export async function GET() {
  try {
    // Mengambil data dari tabel logs di Supabase
    // Mengurutkan berdasarkan kolom 'time' dari yang paling baru (descending)
    // Membatasi hanya 50 data log terakhir agar loading dashboard tetap enteng
    const { data: logs, error } = await db
      .from('activity_logs') // Ganti dengan nama tabel log kamu jika berbeda (misal: 'logs')
      .select('*')
      .order('time', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(logs || []);
  } catch (error) {
    console.error('Gagal mengambil data log dari database:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}