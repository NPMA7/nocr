const { RouterOSAPI } = require('node-routeros');
const { Channel } = require('node-routeros/dist/Channel');
require('dotenv').config();

// Patch node-routeros to support RouterOS 7.18+ '!empty' reply type
const originalProcessPacket = Channel.prototype.processPacket;
Channel.prototype.processPacket = function (packet) {
    if (packet && packet[0] === '!empty') {
        // RouterOS 7.18+ sends '!empty' followed by '!done' for empty prints.
        // We ignore '!empty' (no-op) and let the subsequent '!done' close the channel.
        return;
    }
    return originalProcessPacket.call(this, packet);
};

// We'll support both real connection and demo mode
const isDemoMode = process.env.DEMO_MODE === 'true';

class MikroTikService {
    constructor() {
        this.connections = new Map(); // deviceId -> connection
        this.connecting = new Map();  // deviceId -> connecting Promise
    }

    async connect(device, isRetry = false) {
        if (isDemoMode) return { connected: true, demo: true };
        
        // 1. Return existing connection if still active
        const existing = this.connections.get(device.id);
        if (existing && existing.connected) {
            return { connected: true, api: existing };
        }

        // 2. Wait if already connecting
        if (this.connecting.has(device.id)) {
            try {
                const api = await this.connecting.get(device.id);
                return { connected: true, api };
            } catch (err) {
                return { connected: false, error: err.message };
            }
        }

        // 3. Clean up dead connection if any
        if (existing) {
            existing.close().catch(() => {});
            this.connections.delete(device.id);
        }
        
        // 4. Create new connection and store promise
        const connectPromise = (async () => {
            const api = new RouterOSAPI({
                host: device.ip_address,
                user: device.username || process.env.MIKROTIK_USER,
                password: device.password || process.env.MIKROTIK_PASS || '',
                port: device.port || process.env.MIKROTIK_PORT || 8728,
                timeout: 15, // Timeout 15 detik agar koneksi lebih stabil
                keepalive: false // Matikan keepalive bawaan node-routeros karena menyebabkan false-timeout dengan ROS v7
            });

            // Prevent unhandled error events from crashing the Node process
            api.on('error', (err) => {
                console.error(`MikroTik API Error [${device.ip_address}]:`, err.message);
                this.connections.delete(device.id);
            });
            
            api.on('close', () => {
                this.connections.delete(device.id);
            });

            await api.connect();
            this.connections.set(device.id, api);
            return api;
        })();

        this.connecting.set(device.id, connectPromise);

        try {
            const api = await connectPromise;
            return { connected: true, api };
        } catch (error) {
            console.error(`Failed to connect to MikroTik ${device.ip_address}:`, error?.message || error);

            const errMsg = (error?.message || String(error)).toLowerCase();
            
            // Auto-Dial VPN jika koneksi gagal (hanya sekali)
            if (!isRetry && (errMsg.includes('timeout') || errMsg.includes('econn') || errMsg.includes('enet') || errMsg.includes('ehost'))) {
                try {
                    const { connectVpn } = require('./vpn');
                    console.info(`Mencoba auto-dial VPN karena gagal terhubung ke ${device.ip_address}...`);
                    await connectVpn();
                    console.info('Auto-dial VPN berhasil, mencoba ulang koneksi MikroTik...');
                    return await this.connect(device, true); // Coba lagi
                } catch (vpnErr) {
                    if (vpnErr.message !== 'VPN belum dikonfigurasi') {
                        console.error('Auto-dial VPN gagal:', vpnErr.message);
                    }
                }
            }

            return { connected: false, error: error.message };
        } finally {
            this.connecting.delete(device.id);
        }
    }

    async safeWrite(device, path, params = []) {
        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            return await api.write(path, params);
        } catch (err) {
            console.error(`API Write Error [${device.ip_address}] di ${path}:`, err?.message || err);
            // Tutup secara agresif dan hapus koneksi jika terjadi error/timeout
            // Ini mencegah koneksi 'zombie' yang membuat status di Dashboard jadi hilang/NaN
            api.close().catch(() => {});
            this.connections.delete(device.id);
            throw err;
        }
    }

    async getSystemResource(device) {
        if (isDemoMode) {
            return {
                uptime: '2d 4h 12m',
                'cpu-load': Math.floor(Math.random() * 40) + 10,
                'free-memory': 1024 * 1024 * (Math.floor(Math.random() * 500) + 200),
                'total-memory': 1024 * 1024 * 1024,
                'board-name': 'RB4011',
                version: '7.12'
            };
        }

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        const result = await this.safeWrite(device, '/system/resource/print');
        return result[0];
    }

    async getInterfaces(device) {
        if (isDemoMode) {
            return [
                { name: 'ether1-gateway', type: 'ether', running: 'true', disabled: 'false' },
                { name: 'ether2-olt', type: 'ether', running: 'true', disabled: 'false' },
                { name: 'vlan100-pppoe', type: 'vlan', running: 'true', disabled: 'false' }
            ];
        }

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        return await this.safeWrite(device, '/interface/print');
    }

    async getActivePPPoE(device) {
        if (isDemoMode) {
            return Math.floor(Math.random() * 200) + 50;
        }

        const api = this.connections.get(device.id);
        if (!api) return 0;
        
        try {
            // Filter by service=pppoe to exclude L2TP sessions
            const results = await this.safeWrite(device, '/ppp/active/print', ['?service=pppoe', '=count-only=']);
            return parseInt(results[0]?.ret || 0);
        } catch (e) {
            return 0;
        }
    }

    async getActiveL2TP(device) {
        if (isDemoMode) {
            return Math.floor(Math.random() * 10) + 1;
        }

        const api = this.connections.get(device.id);
        if (!api) return 0;
        
        try {
            // Filter by service=l2tp
            const results = await this.safeWrite(device, '/ppp/active/print', ['?service=l2tp', '=count-only=']);
            return parseInt(results[0]?.ret || 0);
        } catch (e) {
            return 0;
        }
    }

    async getActivePPPoEDetails(device) {
        if (isDemoMode) {
            return [
                { id: '*1', name: 'pelanggan_budi_olt1', service: 'pppoe', address: '10.10.10.254', uptime: '1d 2h' },
                { id: '*2', name: 'pelanggan_ani_vlan10', service: 'pppoe', address: '10.10.10.253', uptime: '5h 12m' },
                { id: '*3', name: 'pelanggan_candra_olt2', service: 'pppoe', address: '10.10.10.252', uptime: '45m' },
                { id: '*4', name: 'pelanggan_dodi_olt1', service: 'pppoe', address: '10.10.10.251', uptime: '3d 21h' },
                { id: '*5', name: 'pelanggan_eka_vlan20', service: 'pppoe', address: '10.10.10.250', uptime: '12d 3h' }
            ];
        }

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            return await this.safeWrite(device, '/ppp/active/print');
        } catch (e) {
            console.error('Error fetching PPPoE details:', e.message);
            return [];
        }
    }

    async getPPPoESecrets(device) {
        if (isDemoMode) {
            return [
                { name: 'budi', service: 'pppoe', profile: 'default', 'last-logged-out': '1d' }
            ];
        }

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            return await this.safeWrite(device, '/ppp/secret/print');
        } catch (e) {
            console.error('Error fetching PPPoE secrets:', e.message);
            return [];
        }
    }

    async addPPPoESecret(device, { name, password, profile, service }) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            await this.safeWrite(device, '/ppp/secret/add', [
                `=name=${name}`,
                `=password=${password}`,
                `=service=${service || 'pppoe'}`,
                `=profile=${profile || 'default'}`
            ]);
            return true;
        } catch (e) {
            throw new Error('Gagal menambah pelanggan: ' + e.message);
        }
    }

    async addInterface(device, { name, type, vlanId, parentInterface }) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            if (type === 'vlan') {
                if (!vlanId || !parentInterface) {
                    throw new Error('VLAN ID dan Parent Interface harus diisi untuk tipe VLAN.');
                }
                await this.safeWrite(device, '/interface/vlan/add', [
                    `=name=${name}`,
                    `=vlan-id=${vlanId}`,
                    `=interface=${parentInterface}`
                ]);
            } else if (type === 'bridge') {
                await this.safeWrite(device, '/interface/bridge/add', [
                    `=name=${name}`
                ]);
            } else {
                throw new Error('Hanya pembuatan VLAN dan Bridge yang didukung secara dinamis.');
            }
            return true;
        } catch (e) {
            throw new Error('Gagal menambah interface: ' + e.message);
        }
    }

    async editPPPoESecret(device, id, { name, password, profile, service }) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            const params = [`=.id=${id}`];
            if (name) params.push(`=name=${name}`);
            if (password) params.push(`=password=${password}`);
            if (profile) params.push(`=profile=${profile}`);
            if (service) params.push(`=service=${service}`);

            await this.safeWrite(device, '/ppp/secret/set', params);
            return true;
        } catch (e) {
            throw new Error('Gagal mengedit pelanggan: ' + e.message);
        }
    }

    async deletePPPoESecret(device, id) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            await this.safeWrite(device, '/ppp/secret/remove', [
                `=.id=${id}`
            ]);
            return true;
        } catch (e) {
            throw new Error('Gagal menghapus pelanggan: ' + e.message);
        }
    }

    async editInterface(device, id, type, { name, mtu, disabled }) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            const params = [`=.id=${id}`];
            if (name) params.push(`=name=${name}`);
            if (mtu !== undefined) params.push(`=mtu=${mtu}`);
            if (disabled !== undefined) params.push(`=disabled=${disabled}`);

            await this.safeWrite(device, '/interface/set', params);
            return true;
        } catch (e) {
            throw new Error('Gagal mengedit interface: ' + e.message);
        }
    }

    async deleteInterface(device, id, type) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            let path = '/interface/remove';
            if (type === 'vlan') path = '/interface/vlan/remove';
            else if (type === 'bridge') path = '/interface/bridge/remove';

            await this.safeWrite(device, path, [
                `=.id=${id}`
            ]);
            return true;
        } catch (e) {
            throw new Error('Gagal menghapus interface: ' + e.message);
        }
    }

    async disconnectPPPoESession(device, id) {
        if (isDemoMode) return true;

        const api = this.connections.get(device.id);
        if (!api) throw new Error('Not connected');

        try {
            await this.safeWrite(device, '/ppp/active/remove', [
                `=.id=${id}`
            ]);
            return true;
        } catch (e) {
            throw new Error('Gagal disconnect sesi: ' + e.message);
        }
    }
}


module.exports = new MikroTikService();
