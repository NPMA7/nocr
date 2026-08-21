/**
 * Template Halaman Diagnostik Saat Web ONT Tidak Dapat Dihubungi / Timeout
 * Digunakan oleh reverse proxy ONT di server.js
 */

function renderOntUnreachableHtml(ip, port, detail) {
    const isDesaPort = (port === 8080);
    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isDesaPort ? 'Web ONT Desa Belum Dikonfigurasi (Port 8080)' : 'Akses Web ONT Tidak Tersedia'} - ${ip}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #0b0f19;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .card {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.85));
            border: 1px solid rgba(148, 163, 184, 0.15);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
            border-radius: 18px;
            max-width: 580px;
            width: 100%;
            padding: 36px 32px;
            text-align: center;
            backdrop-filter: blur(12px);
        }
        .icon-wrap {
            width: 68px;
            height: 68px;
            margin: 0 auto 20px;
            border-radius: 20px;
            background: ${isDesaPort ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)'};
            border: 1px solid ${isDesaPort ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isDesaPort ? '#eab308' : '#f87171'};
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: ${isDesaPort ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border: 1px solid ${isDesaPort ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            color: ${isDesaPort ? '#fef08a' : '#fca5a5'};
            margin-bottom: 16px;
            letter-spacing: 0.02em;
        }
        h1 {
            font-size: 20px;
            font-weight: 700;
            color: #f8fafc;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        .desc {
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .info-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(51, 65, 85, 0.6);
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            margin-bottom: 24px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 6px 0;
            border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-val { color: #cbd5e1; font-weight: 600; font-family: monospace; }
        .actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #2563eb;
            color: #ffffff;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary {
            background: rgba(51, 65, 85, 0.6);
            color: #cbd5e1;
            border: 1px solid rgba(71, 85, 105, 0.6);
        }
        .btn-secondary:hover { background: rgba(71, 85, 105, 0.8); color: #ffffff; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrap">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
        </div>
        <div class="badge">${isDesaPort ? 'DESA ONT REMOTE NAT (PORT 8080) BELUM AKTIF / TIMEOUT' : 'REMOTE ACCESS BLOCKED / UNAVAILABLE'}</div>
        <h1>${isDesaPort ? 'Akses Web ONT Desa Belum Dikonfigurasi (Port 8080)' : 'Akses Web Management ONT Tidak Tersedia'}</h1>
        <p class="desc">
            ${isDesaPort 
                ? `Perangkat Mikrotik Desa pada IP <b>${ip}</b> belum memiliki konfigurasi <b>DST-NAT Port Forwarding (Port 8080 ➔ Port 80 ONT)</b>, atau ONT lokal di bawah Mikrotik sedang offline.`
                : `Perangkat ONT pada IP ini tidak merespons koneksi Web (Port 80 HTTP). Fitur <b>WAN / Remote Web Management</b> kemungkinan belum diaktifkan pada konfigurasi ONT, atau port akses ditutup oleh sistem firewall.`}
        </p>
        
        <div class="info-box">
            <div class="info-row">
                <span class="info-label">${isDesaPort ? 'IP Mikrotik Desa' : 'Target IP ONT'}</span>
                <span class="info-val">${ip}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Port Akses Remote</span>
                <span class="info-val" style="color:${isDesaPort ? '#fbbf24' : '#f87171'};">${port} (TCP)</span>
            </div>
            <div class="info-row">
                <span class="info-label">Diagnosa Sistem</span>
                <span class="info-val" style="color:${isDesaPort ? '#eab308' : '#fbbf24'};">${isDesaPort ? 'DST-NAT 8080 Belum Dikonfigurasi di Mikrotik Desa' : 'WAN Remote Management Nonaktif'}</span>
            </div>

            ${isDesaPort ? `
            <div style="margin-top:14px; text-align:left;">
                <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📜 Script Konfigurasi NAT Mikrotik Desa:</span>
                    <button onclick="navigator.clipboard.writeText('/ip firewall nat\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.10.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.100.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.101.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22'); this.innerText='Tersalin!';" style="background:rgba(59,130,246,0.2); border:1px solid rgba(59,130,246,0.4); color:#93c5fd; padding:3px 8px; border-radius:5px; font-size:10.5px; cursor:pointer;">Salin Script NAT</button>
                </div>
                <pre style="background:#090d16; border:1px solid #1e293b; border-radius:8px; padding:10px; font-size:11px; color:#38bdf8; overflow-x:auto; font-family:monospace; line-height:1.45;">/ip firewall nat
add chain=dstnat protocol=tcp dst-port=8080 \\
action=dst-nat to-addresses=192.168.xxx.xxx to-ports=80 \\
comment="REMOTE ON HTTP"</pre>
            </div>
            ` : `
            <div style="font-size:11.5px; color:#94a3b8; text-align:left; margin-top:12px; line-height:1.5; padding-top:10px; border-top:1px dashed rgba(51,65,85,0.6);">
                💡 <b>Petunjuk:</b> Untuk mengaktifkan remote management pada ONT tipe ini, hubungkan laptop langsung ke port LAN ONT di lokasi, buka IP gateway lokal (192.168.1.1), lalu aktifkan opsi <i>WAN Access / Remote HTTP Management</i> di menu <i>Security / ACL</i>.
            </div>
            `}
        </div>

        <div class="actions">
            <button onclick="window.location.reload()" class="btn btn-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Coba Lagi
            </button>
            <a href="${isDesaPort ? '/monitoring/desa' : '/monitoring/opd'}" class="btn btn-primary">
                Kembali ke ${isDesaPort ? 'Monitoring Desa' : 'Monitoring OPD'}
            </a>
        </div>
    </div>
</body>
</html>`;
}

module.exports = {
    renderOntUnreachableHtml,
};
