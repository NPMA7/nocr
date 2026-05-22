import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { verifyAuth, resolveAuth, enforceRoleForMutation } from '@/lib/auth';
import { getVpnConfig, connectVpn, disconnectVpn, checkVpnStatus } from '@/lib/vpn';
import supabase from '@/lib/supabaseClient';

const vpnConfigFile = path.join(process.cwd(), 'src', 'lib', 'data', 'vpn_config.json');

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req, { params }) {
    const { path: routePath } = await params;
    
    try {
        verifyAuth(req);

        if (routePath[0] === 'status') {
            const statusResult = await checkVpnStatus();
            return NextResponse.json(statusResult);
        }

        if (routePath[0] === 'settings') {
            try {
                const { data, error } = await supabase
                    .from('vpn_settings')
                    .select('name, username, password, windows_name, windows_username, windows_password, linux_name, active_platform')
                    .eq('id', 1)
                    .maybeSingle();
                
                if (data && (data.name || data.windows_name || data.linux_name || data.active_platform)) {
                    return NextResponse.json(data);
                }
            } catch (dbErr) {
                console.error('Failed to fetch VPN config from database, using local fallback:', dbErr.message);
            }
            
            const config = getVpnConfig();
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

        if (routePath[0] === 'connect') {
            try {
                if (global.addActivityLog) {
                    global.addActivityLog('Menghubungkan koneksi VPN Auto-Dial...');
                }
                const stdout = await connectVpn();
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
                const stdout = await disconnectVpn();
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
            
            // Save to local file (needed for local autodial dialer when offline)
            const configDir = path.dirname(vpnConfigFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(vpnConfigFile, JSON.stringify({ 
                name: windows_name || linux_name || name || '', 
                username: windows_username || username || '', 
                password: windows_password || password || '',
                windows_name: windows_name || '',
                windows_username: windows_username || '',
                windows_password: windows_password || '',
                linux_name: linux_name || '',
                active_platform: selectedPlatform
            }, null, 2));

            // Save to database
            let dbSuccess = true;
            let dbErrorMsg = '';
            try {
                const { error: dbErr } = await supabase
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
                    dbSuccess = false;
                    dbErrorMsg = dbErr.message;
                    console.error('Failed to save VPN settings to database:', dbErr.message);
                }
            } catch (dbErr) {
                dbSuccess = false;
                dbErrorMsg = dbErr.message;
                console.error('Failed to save VPN settings to database:', dbErr.message);
            }

            if (global.addActivityLog) {
                const platformName = selectedPlatform === 'linux' ? 'Linux' : 'Windows';
                global.addActivityLog(`Pengaturan VPN Auto-Dial disimpan (${platformName})`);
            }

            if (!dbSuccess) {
                return NextResponse.json({ 
                    success: true, 
                    message: `Konfigurasi VPN disimpan secara lokal, namun gagal disinkronkan ke database: ${dbErrorMsg}` 
                });
            }

            return NextResponse.json({ success: true, message: 'Konfigurasi VPN disimpan ke lokal & database' });
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}
