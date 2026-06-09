import { NextResponse } from 'next/server';
import { verifyAuth, resolveAuth, enforceRoleForMutation } from '@/lib/auth';
import { connectVpn, disconnectVpn, checkVpnStatus } from '@/lib/vpn';
import db from '@/lib/dbClient';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

// Helper internal untuk mengambil konfigurasi VPN dari database Supabase
async function fetchDbConfig() {
    const { data, error } = await db
        .from('vpn_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
    
    if (error || !data) {
        return { 
            name: '', username: '', password: '',
            windows_name: '', windows_username: '', windows_password: '',
            linux_name: '', linux_username: '', linux_password: '',
            active_platform: 'windows'
        };
    }
    return data;
}

export async function GET(req, { params }) {
    const { path: routePath } = await params;
    
    try {
        verifyAuth(req);
        const config = await fetchDbConfig();

        if (routePath[0] === 'status') {
            const statusResult = await checkVpnStatus(config);
            return NextResponse.json(statusResult);
        }

        if (routePath[0] === 'settings') {
            return NextResponse.json(config);
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req, { params }) {
    const { path: routePath } = await params;
    
    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user);
        const config = await fetchDbConfig();

        if (routePath[0] === 'connect') {
            try {
                if (global.addActivityLog) {
                    global.addActivityLog('Menghubungkan koneksi VPN Auto-Dial...');
                }
                const stdout = await connectVpn(config);
                if (global.addActivityLog) {
                    global.addActivityLog('Koneksi VPN Auto-Dial berhasil terhubung');
                }
                return NextResponse.json({ success: true, message: 'VPN Berhasil Terhubung', detail: stdout });
            } catch (error) {
                if (global.addActivityLog) {
                    global.addActivityLog(`Gagal menghubungkan VPN: ${error.message}`);
                }
                return NextResponse.json({ error: 'Gagal terhubung ke VPN', detail: error.message }, { status: 500 });
            }
        }

        if (routePath[0] === 'disconnect') {
            try {
                if (global.addActivityLog) {
                    global.addActivityLog('Memutuskan koneksi VPN Auto-Dial...');
                }
                const stdout = await disconnectVpn(config);
                if (global.addActivityLog) {
                    global.addActivityLog('Koneksi VPN Auto-Dial berhasil diputuskan');
                }
                return NextResponse.json({ success: true, message: 'VPN Berhasil Diputus', detail: stdout });
            } catch (error) {
                if (global.addActivityLog) {
                    global.addActivityLog(`Gagal memutuskan VPN: ${error.message}`);
                }
                return NextResponse.json({ error: 'Gagal memutuskan VPN', detail: error.message }, { status: 500 });
            }
        }

        if (routePath[0] === 'settings') {
            const body = await req.json();
            const { 
                name, username, password,
                windows_name, windows_username, windows_password,
                linux_name, active_platform 
            } = body;
            
            const selectedPlatform = active_platform || 'windows';
            
            if (selectedPlatform === 'linux' && !linux_name) {
                return NextResponse.json({ error: 'Nama peer Linux (pon) wajib diisi' }, { status: 400 });
            }
            if (selectedPlatform === 'windows' && !windows_name) {
                return NextResponse.json({ error: 'Nama profil Windows wajib diisi' }, { status: 400 });
            }

            // Simpan perubahan murni ke database Supabase tanpa menyentuh lokal disk fs
            const { error: dbErr } = await db
                .from('vpn_settings')
                .upsert({
                    id: 1,
                    name: windows_name || linux_name || name || '',
                    username: windows_username || username || '',
                    password: windows_password || password || '',
                    windows_name: windows_name || null,
                    windows_username: windows_username || null,
                    windows_password: windows_password || null,
                    linux_name: linux_name || null,
                    active_platform: selectedPlatform,
                    updated_at: new Date().toISOString()
                });

            if (dbErr) {
                console.error('Failed to save VPN settings to database:', dbErr.message);
                return NextResponse.json({ error: `Gagal menyimpan konfigurasi ke database: ${dbErr.message}` }, { status: 400 });
            }

            if (global.addActivityLog) {
                const platformName = selectedPlatform === 'linux' ? 'Linux' : 'Windows';
                global.addActivityLog(`Pengaturan VPN Auto-Dial disimpan ke database (${platformName})`);
            }

            return NextResponse.json({ success: true, message: 'Konfigurasi VPN berhasil diperbarui di database' });
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}