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
    const typeParam = searchParams.get('type') || 'ALL'; // PPPOE, L2TP, ALL
    const rangeParam = searchParams.get('range') || '7d'; // 7d, 1m, 1y, custom
    
    // Custom range parameters
    const startMonthParam = parseInt(searchParams.get('startMonth') || '0', 10);
    const startYearParam = parseInt(searchParams.get('startYear') || '0', 10);
    const endMonthParam = parseInt(searchParams.get('endMonth') || '0', 10);
    const endYearParam = parseInt(searchParams.get('endYear') || '0', 10);

    // Ambil data DB
    const { data: reports, error } = await db.from('daily_reports').select('*');
    if (error) throw error;

    const { data: allRuijie } = await db.from('ruijie_devices').select('mac_address, connection_type');
    const typeMap = Object.fromEntries((allRuijie || []).map(r => [r.mac_address, r.connection_type]));

    const today = new Date();
    const todayStr = today.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });

    // Tentukan range tanggal
    let startDate = new Date();
    let endDate = new Date();

    if (rangeParam === '7d') {
      startDate.setDate(today.getDate() - 6);
    } else if (rangeParam === '1m') {
      startDate.setDate(today.getDate() - 29);
    } else if (rangeParam === '1y') {
      startDate.setDate(today.getDate() - 364);
    } else if (rangeParam === 'all') {
      if (reports && reports.length > 0) {
        const dates = reports
          .filter(r => r.report_date)
          .map(r => new Date(r.report_date).getTime());
        if (dates.length > 0) {
          startDate = new Date(Math.min(...dates));
        } else {
          startDate.setDate(today.getDate() - 6);
        }
      } else {
        startDate.setDate(today.getDate() - 6);
      }
    } else if (rangeParam === 'custom') {
      if (startMonthParam > 0 && startYearParam > 0 && endMonthParam > 0 && endYearParam > 0) {
        startDate = new Date(startYearParam, startMonthParam - 1, 1);
        endDate = new Date(endYearParam, endMonthParam, 0); // Hari terakhir bulan tersebut
      } else {
        startDate.setDate(today.getDate() - 6);
      }
    }

    // Set waktu mulai di 00:00:00 dan selesai di 23:59:59 zona Asia/Jakarta
    const startStr = startDate.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });
    const endStr = endDate.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });

    // Filter reports berdasarkan tanggal dan tipe
    const filteredReports = (reports || []).filter(r => {
      const reportDate = r.report_date ? new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) : '';
      if (!reportDate) return false;

      // Filter Range Tanggal
      if (rangeParam === 'custom' && startMonthParam > 0 && startYearParam > 0 && endMonthParam > 0 && endYearParam > 0) {
        if (reportDate < startStr || reportDate > endStr) return false;
      } else if (rangeParam !== 'all') {
        if (reportDate < startStr || reportDate > todayStr) return false;
      }

      // Filter Tipe Koneksi
      const type = r.ruijie_mac && r.ruijie_mac.startsWith('MANUAL_') 
        ? (r.ruijie_mac.includes('PPPOE') ? 'PPPOE' : 'L2TP')
        : (typeMap[r.ruijie_mac] || 'Unknown');

      if (typeParam !== 'ALL' && type !== typeParam) return false;

      // Filter durasi offline di bawah 10 menit (agar sinkron dengan filter di list harian)
      if (r.offline_since && r.online_since && (!r.ruijie_mac || !r.ruijie_mac.startsWith('MANUAL_'))) {
        const durationMs = new Date(r.online_since).getTime() - new Date(r.offline_since).getTime();
        if (durationMs < 10 * 60 * 1000) return false;
      }

      return true;
    });

    // 1. Hitung Statistik Utama
    const totalReports = filteredReports.length;

    // Hitung jumlah hari aktif dalam period ini untuk rata-rata harian
    let dayCount = 7;
    if (rangeParam === '1m') dayCount = 30;
    else if (rangeParam === '1y') dayCount = 365;
    else if (rangeParam === 'all' || rangeParam === 'custom') {
      const limitDate = rangeParam === 'custom' ? endDate : today;
      const diffTime = Math.abs(limitDate - startDate);
      dayCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    const averagePerDay = dayCount > 0 ? parseFloat((totalReports / dayCount).toFixed(2)) : 0;

    // 2. Trend Data (Grafik Total Laporan)
    const trendMap = {};
    if (rangeParam === '1y' || rangeParam === 'all') {
      // Group bulanan untuk rentang 1 tahun atau all time
      const tempDate = new Date(startDate);
      tempDate.setDate(1);
      const endLimit = today;
      while (tempDate <= endLimit) {
        const monthKey = tempDate.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 7); // YYYY-MM
        trendMap[monthKey] = { label: monthKey, count: 0 };
        tempDate.setMonth(tempDate.getMonth() + 1);
      }

      filteredReports.forEach(r => {
        const reportMonth = r.report_date ? new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }).slice(0, 7) : '';
        if (trendMap[reportMonth]) {
          trendMap[reportMonth].count++;
        }
      });
    } else {
      // Group harian untuk 7d, 1m, custom
      const tempDate = new Date(startDate);
      const endLimit = rangeParam === 'custom' ? endDate : today;
      while (tempDate <= endLimit) {
        const dateKey = tempDate.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });
        trendMap[dateKey] = { label: dateKey, count: 0 };
        tempDate.setDate(tempDate.getDate() + 1);
      }

      filteredReports.forEach(r => {
        const reportDate = r.report_date ? new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) : '';
        if (trendMap[reportDate]) {
          trendMap[reportDate].count++;
        }
      });
    }

    const trend = Object.values(trendMap);

    // 3. Grafik Rata-rata Mingguan (Minggu 1-5)
    // Kelompokkan per minggu berdasarkan tanggal (hari ke-1 sampai 31)
    const weeklyCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const monthYearCounts = new Set(); // Simpan kombinasi bulan-tahun untuk menghitung rata-rata

    filteredReports.forEach(r => {
      if (!r.report_date) return;
      const dateObj = new Date(r.report_date);
      const dayOfMonth = dateObj.getDate();
      const monthYearKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
      monthYearCounts.add(monthYearKey);

      let weekNum = 1;
      if (dayOfMonth <= 7) weekNum = 1;
      else if (dayOfMonth <= 14) weekNum = 2;
      else if (dayOfMonth <= 21) weekNum = 3;
      else if (dayOfMonth <= 28) weekNum = 4;
      else weekNum = 5;

      weeklyCounts[weekNum]++;
    });

    const monthsInPeriod = Math.max(monthYearCounts.size, 1);
    const weeklyAverage = [
      { week: 'Minggu 1', average: parseFloat((weeklyCounts[1] / monthsInPeriod).toFixed(1)) },
      { week: 'Minggu 2', average: parseFloat((weeklyCounts[2] / monthsInPeriod).toFixed(1)) },
      { week: 'Minggu 3', average: parseFloat((weeklyCounts[3] / monthsInPeriod).toFixed(1)) },
      { week: 'Minggu 4', average: parseFloat((weeklyCounts[4] / monthsInPeriod).toFixed(1)) },
      { week: 'Minggu 5', average: parseFloat((weeklyCounts[5] / monthsInPeriod).toFixed(1)) }
    ];

    // 4. Grafik Top Laporan Perangkat/Sites Terbanyak
    const deviceDetailsMap = {};
    filteredReports.forEach(r => {
      const name = r.prefix_name || r.ruijie_mac || 'UNKNOWN';
      const type = r.ruijie_mac && r.ruijie_mac.startsWith('MANUAL_')
        ? (r.ruijie_mac.includes('PPPOE') ? 'PPPOE' : 'L2TP')
        : (typeMap[r.ruijie_mac] || 'Unknown');

      if (!deviceDetailsMap[name]) {
        deviceDetailsMap[name] = { name, count: 0, type, mac: r.ruijie_mac || '' };
      }
      deviceDetailsMap[name].count++;
    });

    const allDevices = Object.values(deviceDetailsMap).sort((a, b) => b.count - a.count);
    const topDevices = allDevices.slice(0, 10);

    // List saat ini offline (tetap diambil realtime dari DB, tanpa dipengaruhi rentang tanggal lama)
    const activeOfflineList = (reports || [])
      .filter(r => r.status_progress === 'Progress')
      .map(r => {
        const type = r.ruijie_mac && r.ruijie_mac.startsWith('MANUAL_')
          ? (r.ruijie_mac.includes('PPPOE') ? 'PPPOE' : 'L2TP')
          : (typeMap[r.ruijie_mac] || 'Unknown');
        return {
          id: r.id,
          prefix_name: r.prefix_name,
          offline_since: r.offline_since,
          type,
          issue: r.issue || 'Belum diisi'
        };
      })
      .sort((a, b) => new Date(b.offline_since) - new Date(a.offline_since));

    // 5. Top Kendala/Issue Terbanyak
    const issueCounts = {};
    filteredReports.forEach(r => {
      if (!r.issue || !r.issue.trim()) return;
      const key = r.issue.trim();
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    });

    const topIssues = Object.entries(issueCounts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        totalReports,
        averagePerDay,
        currentlyOffline: activeOfflineList.length
      },
      trend,
      weeklyAverage,
      topDevices,
      allDevices,
      topIssues,
      activeOfflineList
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
