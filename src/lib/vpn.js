const { exec } = require('child_process');

// Fungsi ini sekarang tidak lagi membaca file JSON lokal, melainkan menerima objek konfigurasi langsung
const connectVpn = (config) => new Promise((resolve, reject) => {
    if (!config) return reject(new Error('Konfigurasi VPN tidak ditemukan atau kosong'));

    const activePlatform = config.active_platform || (process.platform === 'linux' ? 'linux' : 'windows');
    const isLinux = activePlatform === 'linux';
    const name = isLinux ? (config.linux_name || config.name) : (config.windows_name || config.name);
    const username = config.windows_username || config.username;
    const password = config.windows_password || config.password;

    if (!name) return reject(new Error('VPN belum dikonfigurasi untuk platform ' + (isLinux ? 'Linux' : 'Windows')));
    
    const cmd = isLinux ? `pon "${name}"` : (() => {
        let winCmd = `rasdial "${name}"`;
        if (username) winCmd += ` "${username}"`;
        if (password) winCmd += ` "${password}"`;
        return winCmd;
    })();
    
    exec(cmd, (error, stdout, stderr) => {
        if (isLinux) {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout || `Mengaktifkan peer ${name}...`);
            }
        } else {
            if (error && !stdout.includes('already connected') && !stdout.includes('Command completed successfully')) {
                reject(new Error(stdout || error.message));
            } else {
                resolve(stdout);
            }
        }
    });
});

const disconnectVpn = (config) => new Promise((resolve, reject) => {
    if (!config) return reject(new Error('Konfigurasi VPN tidak ditemukan atau kosong'));

    const activePlatform = config.active_platform || (process.platform === 'linux' ? 'linux' : 'windows');
    const isLinux = activePlatform === 'linux';
    const name = isLinux ? (config.linux_name || config.name) : (config.windows_name || config.name);
    
    if (!name) return reject(new Error('VPN belum dikonfigurasi untuk platform ' + (isLinux ? 'Linux' : 'Windows')));

    const cmd = isLinux ? `poff "${name}"` : `rasdial "${name}" /disconnect`;

    exec(cmd, (error, stdout, stderr) => {
        if (isLinux) {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout || `Mematikan peer ${name}...`);
            }
        } else {
            if (error) {
                reject(new Error(stdout || error.message));
            } else {
                resolve(stdout);
            }
        }
    });
});

const checkVpnStatus = (config) => new Promise((resolve) => {
    if (!config) return resolve({ connected: false, message: 'VPN belum dikonfigurasi di database' });

    const activePlatform = config.active_platform || (process.platform === 'linux' ? 'linux' : 'windows');
    const isLinux = activePlatform === 'linux';
    const name = isLinux ? (config.linux_name || config.name) : (config.windows_name || config.name);
    
    if (!name) {
        return resolve({ connected: false, message: 'VPN belum dikonfigurasi untuk platform ' + (isLinux ? 'Linux' : 'Windows') });
    }

    if (isLinux) {
        exec('ps ax', (error, stdout) => {
            if (error) {
                return resolve({ connected: false, message: `Gagal memeriksa status: ${error.message}` });
            }
            const isConnected = stdout.includes(`pppd call ${name}`) || 
                                stdout.includes(`pppd ${name}`) ||
                                (stdout.includes('pppd') && stdout.includes(name));
            
            if (isConnected) {
                resolve({ connected: true, message: `Terhubung ke peer ${name}` });
            } else {
                resolve({ connected: false, message: 'VPN tidak terhubung' });
            }
        });
    } else {
        exec('rasdial', (error, stdout) => {
            if (stdout && stdout.includes(name)) {
                resolve({ connected: true, message: `Terhubung ke ${name}` });
            } else {
                resolve({ connected: false, message: 'VPN tidak terhubung' });
            }
        });
    }
});

module.exports = {
    connectVpn,
    disconnectVpn,
    checkVpnStatus
};