import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import { Pool } from 'pg';
import { verifyAuth, resolveAuth, enforceRoleForMutation } from '@/lib/auth';

const execAsync = util.promisify(exec);

// Inisialisasi pool PostgreSQL secara independen untuk route ini
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export async function GET(req) {
    try {
        verifyAuth(req);

        // 1. OS Stats
        const osStats = {
            uptime: os.uptime(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            loadAvg: os.loadavg()
        };

        // 2. Postgres Stats
        let dbStats = { error: 'Gagal mengambil metrik DB' };
        try {
            const dbSizeRes = await pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
            const connRes = await pool.query('SELECT count(*) as active_connections FROM pg_stat_activity');
            const verRes = await pool.query('SELECT version()');
            dbStats = {
                size: dbSizeRes.rows[0].size,
                active_connections: parseInt(connRes.rows[0].active_connections, 10),
                version: verRes.rows[0].version
            };
        } catch (dbErr) {
            console.error('DB Stats Error:', dbErr);
        }

        // 3. PM2 Stats
        let pm2Stats = [];
        try {
            const { stdout } = await execAsync('pm2 jlist');
            const pm2List = JSON.parse(stdout);
            const targetApps = ['nocr-app', 'ruijie-api', 'ruijie-scraper'];
            
            pm2Stats = pm2List
                .filter(app => targetApps.includes(app.name))
                .map(app => ({
                    name: app.name,
                    status: app.pm2_env.status,
                    memory: app.monit?.memory || 0,
                    cpu: app.monit?.cpu || 0,
                    uptime: app.pm2_env.pm_uptime ? (Date.now() - app.pm2_env.pm_uptime) : 0,
                    restarts: app.pm2_env.restart_time || 0
                }));
        } catch (pm2Err) {
            console.error('PM2 Stats Error:', pm2Err);
            pm2Stats = { error: 'Gagal mengambil metrik PM2' };
        }

        return NextResponse.json({
            os: osStats,
            db: dbStats,
            pm2: pm2Stats
        });

    } catch (err) {
        return NextResponse.json(
            { error: err.message || 'Server Error' },
            { status: err.status || 500 }
        );
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user, 'settings-health');

        const body = await req.json();
        
        if (body.action === 'restart' && body.app_name) {
            const targetApps = ['nocr-app', 'ruijie-api', 'ruijie-scraper'];
            if (!targetApps.includes(body.app_name)) {
                return NextResponse.json({ error: 'Aplikasi PM2 tidak valid' }, { status: 400 });
            }
            
            await execAsync(`pm2 restart ${body.app_name}`);
            
            if (global.addActivityLog) {
                global.addActivityLog(`Layanan ${body.app_name} di-restart melalui dasbor kesehatan`);
            }
            
            return NextResponse.json({ success: true, message: `${body.app_name} berhasil di-restart!` });
        }
        
        return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
    } catch (err) {
        return NextResponse.json(
            { error: err.message || 'Server Error' },
            { status: err.status || 500 }
        );
    }
}
