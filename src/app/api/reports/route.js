import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth } from '@/lib/auth';
import { hasAccess } from '@/lib/roles';

export async function GET(request) {
  try {
    let user;
    try {
      user = await resolveAuth(request);
    } catch(e) {
      return NextResponse.json({ error: e.message || 'Unauthorized' }, { status: 401 });
    }
    if (!hasAccess(user, 'laporan-harian', 'read')) {
      return NextResponse.json({ error: 'Akses Ditolak: Membaca Laporan Harian' }, { status: 403 });
    }

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
      if (r.ruijie_mac && r.ruijie_mac.startsWith('MANUAL_')) {
        if (!r.ruijie_mac.startsWith(`MANUAL_${type}`)) return false;
      } else if (typeMap[r.ruijie_mac] !== type) {
        return false;
      }

      // Abaikan jika durasi offline kurang dari 10 menit (hanya untuk log otomatis, bukan input manual)
      if (r.offline_since && r.online_since && (!r.ruijie_mac || !r.ruijie_mac.startsWith('MANUAL_'))) {
        const durationMs = new Date(r.online_since).getTime() - new Date(r.offline_since).getTime();
        if (durationMs < 10 * 60 * 1000) {
          return false;
        }
      }

      const reportDateOnly = r.report_date ? new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) : '';
      const isDateStr = reportDateOnly === dateStr;
      const isPastProgress = new Date(reportDateOnly) < new Date(dateStr) && r.status_progress === 'Progress';
      
      return isDateStr || isPastProgress;
    });

    filteredReports.sort((a, b) => (a.prefix_name || '').localeCompare(b.prefix_name || ''));

    return NextResponse.json(filteredReports);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    let user;
    try { user = await resolveAuth(request); } catch(e) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!hasAccess(user, 'laporan-harian', 'update')) return NextResponse.json({ error: 'Akses Ditolak: Update Laporan Harian' }, { status: 403 });

    const body = await request.json();
    const { id, status_progress, issue, tindakan, offline_since, online_since } = body;

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { data, error } = await db
      .from('daily_reports')
      .update({ status_progress, issue, tindakan, offline_since, online_since, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    let user;
    try { user = await resolveAuth(request); } catch(e) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!hasAccess(user, 'laporan-harian', 'delete')) return NextResponse.json({ error: 'Akses Ditolak: Hapus Laporan Harian' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await db.from('daily_reports').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let user;
    try { user = await resolveAuth(request); } catch(e) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    if (!hasAccess(user, 'laporan-harian', 'create')) return NextResponse.json({ error: 'Akses Ditolak: Tambah Laporan Harian' }, { status: 403 });

    const body = await request.json();

    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ error: 'Array is empty' }, { status: 400 });
      }

      const reportsToProcess = body.map((r, idx) => {
        const type = r.type || 'L2TP';
        const reportDate = r.date || new Date().toISOString().split('T')[0];
        return {
          report_date: reportDate,
          ruijie_mac: r.ruijie_mac || `MANUAL_${type}_${Date.now()}_${idx}`,
          prefix_name: r.prefix_name || 'MANUAL ENTRY',
          location: r.location || '',
          offline_since: r.offline_since || null,
          online_since: r.online_since || null,
          status_progress: r.status_progress || 'Progress',
          issue: r.issue || '',
          tindakan: r.tindakan || ''
        };
      });

      // Fetch existing reports: either on the target dates OR currently in Progress
      const targetDates = Array.from(new Set(reportsToProcess.map(r => r.report_date)));
      const { data: existingReports, error: fetchErr } = await db
        .from('daily_reports')
        .select('id, prefix_name, location, report_date, status_progress');
      if (fetchErr) throw fetchErr;

      const exactMap = {};
      const pendingMap = {};

      (existingReports || []).forEach(r => {
        const dateStr = r.report_date ? new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) : '';
        const key = `${(r.prefix_name || '').toLowerCase()}_${(r.location || '').toLowerCase()}_${dateStr}`;
        exactMap[key] = r;

        if (r.status_progress === 'Progress') {
          const deviceKey = `${(r.prefix_name || '').toLowerCase()}_${(r.location || '').toLowerCase()}`;
          pendingMap[deviceKey] = r;
        }
      });

      const toInsert = [];
      const toUpdate = [];

      reportsToProcess.forEach(r => {
        const key = `${(r.prefix_name || '').toLowerCase()}_${(r.location || '').toLowerCase()}_${r.report_date}`;
        const deviceKey = `${(r.prefix_name || '').toLowerCase()}_${(r.location || '').toLowerCase()}`;

        // Match exact or pending
        let match = exactMap[key] || pendingMap[deviceKey];

        if (match) {
          toUpdate.push({
            id: match.id,
            report_date: r.report_date, // Move the record to the active target date
            online_since: r.online_since,
            status_progress: r.status_progress,
            issue: r.issue,
            tindakan: r.tindakan
          });
        } else {
          toInsert.push(r);
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;

      if (toInsert.length > 0) {
        const { error: insErr } = await db.from('daily_reports').insert(toInsert);
        if (insErr) throw insErr;
        insertedCount = toInsert.length;
      }

      if (toUpdate.length > 0) {
        for (const u of toUpdate) {
          const { error: updErr } = await db
            .from('daily_reports')
            .update({
              report_date: u.report_date,
              online_since: u.online_since,
              status_progress: u.status_progress,
              issue: u.issue,
              tindakan: u.tindakan,
              updated_at: new Date().toISOString()
            })
            .eq('id', u.id);
          if (updErr) throw updErr;
        }
        updatedCount = toUpdate.length;
      }

      return NextResponse.json({
        success: true,
        count: insertedCount + updatedCount,
        inserted: insertedCount,
        updated: updatedCount,
        message: `Berhasil memproses ${insertedCount} data baru dan memperbarui ${updatedCount} data lama.`
      });
    }

    const { date, type, prefix_name, offline_since, online_since, status_progress, issue, tindakan } = body;
    
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });
    
    const newReport = {
      report_date: date,
      ruijie_mac: `MANUAL_${type}_${Date.now()}`,
      prefix_name: prefix_name || 'MANUAL ENTRY',
      location: '',
      offline_since: offline_since || null,
      online_since: online_since || null,
      status_progress: status_progress || 'Progress',
      issue: issue || '',
      tindakan: tindakan || ''
    };
    
    const { data, error } = await db.from('daily_reports').insert([newReport]);
    if (error) throw error;
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
