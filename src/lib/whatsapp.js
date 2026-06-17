const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

let client = null;
let status = 'disconnected'; // 'disconnected', 'qr', 'connected', 'loading'
let qrCodeDataURL = null;

const SETTINGS_FILE = path.join(__dirname, '../../data/whatsapp_settings.json');

// Helper untuk membaca pengaturan (auto reply, bot enable dll)
function getSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Gagal membaca whatsapp_settings.json', e);
    }
    return { autoReply: false, botEnabled: true };
}

function saveSettings(settings) {
    try {
        if (!fs.existsSync(path.dirname(SETTINGS_FILE))) {
            fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.error('Gagal menyimpan whatsapp_settings.json', e);
    }
}

async function start() {
    if (client) {
        if (status === 'connected') return { success: true, message: 'Sudah terhubung' };
        if (status === 'qr') return { success: true, message: 'Menunggu scan QR' };
        // If disconnected, clean up and start over
        try { await client.destroy(); } catch (e) {}
    }

    status = 'loading';
    qrCodeDataURL = null;
    broadcastStatus();

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '../../.wwebjs_auth') }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
        }
    });

    client.on('qr', async (qr) => {
        status = 'qr';
        try {
            qrCodeDataURL = await qrcode.toDataURL(qr);
            if (global.io) {
                global.io.emit('wa_qr', { qr: qrCodeDataURL });
            }
            broadcastStatus();
        } catch (err) {
            console.error('Failed to generate QR Data URL', err);
        }
    });

    client.on('ready', () => {
        status = 'connected';
        qrCodeDataURL = null;
        console.log('WhatsApp Client is ready!');
        broadcastStatus();
        if (global.addActivityLog) {
            global.addActivityLog('WhatsApp Gateway terhubung dan siap digunakan.');
        }
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Authenticated');
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Authentication failure', msg);
        status = 'disconnected';
        broadcastStatus();
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp Client disconnected', reason);
        status = 'disconnected';
        client = null;
        broadcastStatus();
        if (global.addActivityLog) {
            global.addActivityLog('WhatsApp Gateway terputus.');
        }
    });

    client.on('message', async (msg) => {
        if (global.io) {
            // Memancarkan pesan yang masuk ke UI Live Chat
            global.io.emit('wa_message_received', {
                id: msg.id._serialized,
                from: msg.from,
                to: msg.to,
                body: msg.body,
                timestamp: msg.timestamp,
                fromMe: msg.fromMe
            });
        }

        const settings = getSettings();
        if (settings.botEnabled && settings.autoReply && !msg.fromMe) {
            // Contoh logic Auto Reply sederhana
            if (msg.body.toLowerCase() === 'ping') {
                msg.reply('pong');
            } else if (msg.body.toLowerCase() === 'info') {
                msg.reply('Ini adalah nomor sistem NOCR. Silakan hubungi admin kami untuk bantuan.');
            }
        }
    });

    client.on('message_create', (msg) => {
        // Ini menangkap pesan baik yang masuk maupun yang kita kirim dari device asli atau web
        if (msg.fromMe && global.io) {
            global.io.emit('wa_message_sent', {
                id: msg.id._serialized,
                from: msg.from,
                to: msg.to,
                body: msg.body,
                timestamp: msg.timestamp,
                fromMe: msg.fromMe,
                ack: msg.ack
            });
        }
    });

    client.on('message_ack', (msg, ack) => {
        if (global.io) {
            global.io.emit('wa_message_ack', {
                id: msg.id._serialized,
                ack: ack
            });
        }
    });

    try {
        await client.initialize();
        return { success: true, message: 'Inisialisasi klien WhatsApp dimulai' };
    } catch (e) {
        console.error('Gagal menginisialisasi client', e);
        status = 'disconnected';
        client = null;
        broadcastStatus();
        return { success: false, error: e.message };
    }
}

async function stop() {
    if (!client) return { success: true, message: 'Sudah dihentikan' };
    try {
        await client.destroy();
        client = null;
        status = 'disconnected';
        qrCodeDataURL = null;
        broadcastStatus();
        return { success: true, message: 'Klien WhatsApp dihentikan' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function logout() {
    if (!client) return { success: false, message: 'Klien belum berjalan' };
    try {
        await client.logout();
        client = null;
        status = 'disconnected';
        qrCodeDataURL = null;
        broadcastStatus();
        return { success: true, message: 'Berhasil logout' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function getStatus() {
    return {
        status,
        qr: status === 'qr' ? qrCodeDataURL : null,
        settings: getSettings()
    };
}

function broadcastStatus() {
    if (global.io) {
        global.io.emit('wa_status', getStatus());
    }
}

// Fitur Omnichannel: Proxy Data
async function getChats() {
    if (status !== 'connected' || !client) return [];
    try {
        const chats = await client.getChats();
        return chats.map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user,
            unreadCount: c.unreadCount,
            timestamp: c.timestamp,
            isGroup: c.isGroup,
            lastMessage: c.lastMessage ? {
                body: c.lastMessage.body,
                timestamp: c.lastMessage.timestamp,
                fromMe: c.lastMessage.fromMe
            } : null
        }));
    } catch (e) {
        console.error('Failed to get chats', e);
        return [];
    }
}

async function getChatMessages(chatId, limit = 50) {
    if (status !== 'connected' || !client) return [];
    try {
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });
        return messages.map(m => ({
            id: m.id._serialized,
            from: m.from,
            to: m.to,
            body: m.body,
            timestamp: m.timestamp,
            fromMe: m.fromMe,
            hasMedia: m.hasMedia,
            ack: m.ack
        }));
    } catch (e) {
        console.error('Failed to get messages', e);
        return [];
    }
}

async function sendMessage(chatId, body) {
    if (status !== 'connected' || !client) throw new Error('WhatsApp tidak terhubung');
    try {
        const response = await client.sendMessage(chatId, body);
        return {
            id: response.id._serialized,
            from: response.from,
            to: response.to,
            body: response.body,
            timestamp: response.timestamp,
            fromMe: response.fromMe
        };
    } catch (e) {
        console.error('Failed to send message', e);
        throw e;
    }
}

module.exports = {
    start,
    stop,
    logout,
    getStatus,
    getSettings,
    saveSettings,
    getChats,
    getChatMessages,
    sendMessage
};
