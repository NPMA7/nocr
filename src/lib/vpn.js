const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const vpnConfigFile = path.join(process.cwd(), 'src', 'lib', 'data', 'vpn_config.json');

const getVpnConfig = () => {
    try {
        if (fs.existsSync(vpnConfigFile)) {
            const data = fs.readFileSync(vpnConfigFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading VPN config:', e);
    }
    return { 
        name: '', username: '', password: '',
        windows_name: '', windows_username: '', windows_password: '',
        linux_name: '', linux_username: '', linux_password: '',
        active_platform: 'windows'
    };
};

const connectVpn = () => new Promise((resolve, reject) => {
    const config = getVpnConfig();
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

const disconnectVpn = () => new Promise((resolve, reject) => {
    const config = getVpnConfig();
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

const checkVpnStatus = () => new Promise((resolve) => {
    const config = getVpnConfig();
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
    getVpnConfig,
    connectVpn,
    disconnectVpn,
    checkVpnStatus
};

