import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const type = searchParams.get('type') || 'PPPOE';
    if (!dateStr) {
      return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Auto-generate dihapus sesuai instruksi, data diambil murni dari activity_logs.

    // Ambil ulang semua report dari DB
    const { data: updatedReports, error } = await db.from('daily_reports').select('*');
    if (error) throw error;
    
    // Ambil tipe koneksi untuk filtering
    const { data: allRuijie } = await db.from('ruijie_devices').select('mac_address, connection_type');
    const typeMap = Object.fromEntries((allRuijie || []).map(r => [r.mac_address, r.connection_type]));

    // Filter sesuai request: 
    // offline di tanggal dateStr, ATAU sebelumnya tapi status masih Progress.
    // jam online juga harus dateStr
    const filteredReports = (updatedReports || []).filter(r => {
      // Cek tipe koneksi
      if (typeMap[r.ruijie_mac] !== type) return false;

      const reportDateOnly = r.report_date ? new Date(r.report_date).toISOString().split('T')[0] : '';
      const isDateStr = reportDateOnly === dateStr;
      const isPastProgress = new Date(reportDateOnly) < new Date(dateStr) && r.status_progress === 'Progress';
      
      let pass = isDateStr || isPastProgress;
      
      // Jika punya online_since, harus di tanggal dateStr juga
      if (r.online_since) {
        const onlineDateStr = new Date(r.online_since).toISOString().split('T')[0];
        if (onlineDateStr !== dateStr) {
          // jika online_since bukan dateStr (misal kemarin), jangan tampil di report hari ini
          // kecuali statusnya masih progress yang mana agak aneh kalau online tapi progress, tp jaga-jaga
          if (!isPastProgress) pass = false;
        }
      }
      return pass;
    });

    filteredReports.sort((a, b) => (a.prefix_name || '').localeCompare(b.prefix_name || ''));

    return NextResponse.json(filteredReports);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, status_progress, issue, tindakan } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data, error } = await db
      .from('daily_reports')
      .update({ status_progress, issue, tindakan, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
