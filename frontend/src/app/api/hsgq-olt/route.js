import { NextResponse } from 'next/server';
import axios from 'axios';
import { verifyAuth, resolveAuth, hasAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Global object to track pending updates across all users
if (!global.pendingWifiUpdates) {
  global.pendingWifiUpdates = {};
}
if (!global.pendingNameUpdates) {
  global.pendingNameUpdates = {};
}
if (!global.hsgqTokenCache) {
  global.hsgqTokenCache = null;
}
global.hsgqTokenTimestamp = global.hsgqTokenTimestamp || 0;

async function getHsgqToken(forceRefresh = false) {
  const isExpired = !global.hsgqTokenCache || (Date.now() - (global.hsgqTokenTimestamp || 0) > 120000);
  if (!forceRefresh && !isExpired && global.hsgqTokenCache) return global.hsgqTokenCache;
  
  const url = process.env.HSGQ_OLT_URL;
  const username = process.env.HSGQ_OLT_USERNAME;
  const key = process.env.HSGQ_OLT_KEY;
  const value = process.env.HSGQ_OLT_VALUE;
  
  if (!username || !key || !value) {
    global.hsgqTokenCache = process.env.HSGQ_OLT_TOKEN || '';
    global.hsgqTokenTimestamp = Date.now();
    return global.hsgqTokenCache;
  }
  
  try {
    const payload = {
        method: "set",
        param: { name: username, key: key, value: value, captcha_v: "", captcha_f: "" }
    };
    const res = await axios.post(`${url}/userlogin?form=login`, payload, {
        headers: { 'Content-Type': 'application/json;charset=UTF-8', 'x-token': 'null' },
        timeout: 10000
    });
    if (res.data && res.data.code === 1 && res.headers['x-token']) {
      global.hsgqTokenCache = res.headers['x-token'];
      global.hsgqTokenTimestamp = Date.now();
      return global.hsgqTokenCache;
    }
  } catch (e) {
  }
  
  global.hsgqTokenCache = process.env.HSGQ_OLT_TOKEN || '';
  global.hsgqTokenTimestamp = Date.now();
  return global.hsgqTokenCache;
}

function isTokenError(resData) {
  if (!resData) return true;
  if (resData.code !== 1) {
    if (!resData.data) return true;
    const msg = (resData.message || '').toLowerCase();
    if (msg.includes('token') || msg.includes('timeout') || msg.includes('login') || msg.includes('failed') || msg.includes('expired')) {
      return true;
    }
  }
  return false;
}

export async function GET(request) {
  try {
    const user = await resolveAuth(request);
    if (!hasAccess(user, 'devices-hsgq', 'read')) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat perangkat HSGQ OLT' }, { status: 403 });
    }
    const url = process.env.HSGQ_OLT_URL;
    if (!url || process.env.DEMO_MODE === 'true') {
      const mockOltData = {
        code: 1,
        message: 'Success (Demo Mode)',
        data: [
          { identifier: 257, port_id: 1, ont_id: 1, ont_name: 'DESA-SUKAMAKMUR', name: 'DESA-SUKAMAKMUR', ont_sn: 'HSGQ01A12345', sn: 'HSGQ01A12345', rstate: 1, rec_optical_power: -19.45, last_up_time: '2026-09-11 14:20:10', last_down_time: '-', last_down_cause: '-', ont_description: 'Kantor Desa Sukamakmur', wifiname: 'SUKAMAKMUR_FREE', sharekey: 'sukamakmur123', securitymode: 4, channel: 6, bandwidth: 1, isolation: 0, broadcast: 1, enable: 1 },
          { identifier: 258, port_id: 1, ont_id: 2, ont_name: 'DESA-BOJONGGEDE', name: 'DESA-BOJONGGEDE', ont_sn: 'HSGQ01A12346', sn: 'HSGQ01A12346', rstate: 1, rec_optical_power: -21.20, last_up_time: '2026-09-11 12:10:05', last_down_time: '-', last_down_cause: '-', ont_description: 'Kantor Desa Bojonggede', wifiname: 'BOJONGGEDE_NET', sharekey: 'bojonggede123', securitymode: 4, channel: 1, bandwidth: 1, isolation: 0, broadcast: 1, enable: 1 },
          { identifier: 513, port_id: 2, ont_id: 1, ont_name: 'OPD-DISMINFO', name: 'OPD-DISMINFO', ont_sn: 'HSGQ02B12347', sn: 'HSGQ02B12347', rstate: 1, rec_optical_power: -18.30, last_up_time: '2026-09-10 09:00:00', last_down_time: '-', last_down_cause: '-', ont_description: 'Dinas Komunikasi dan Informatika', wifiname: 'DISKOMINFO_LAN', sharekey: 'diskominfo123', securitymode: 4, channel: 11, bandwidth: 1, isolation: 0, broadcast: 1, enable: 1 },
          { identifier: 514, port_id: 2, ont_id: 2, ont_name: 'OPD-BAPPEDA', name: 'OPD-BAPPEDA', ont_sn: 'HSGQ02B12348', sn: 'HSGQ02B12348', rstate: 2, rec_optical_power: -29.80, last_up_time: '2026-09-08 11:30:15', last_down_time: '2026-09-11 08:45:00', last_down_cause: 'dying-gasp', ont_description: 'Badan Perencanaan Pembangunan', wifiname: 'BAPPEDA_GUEST', sharekey: 'bappeda123', securitymode: 4, channel: 6, bandwidth: 1, isolation: 0, broadcast: 1, enable: 1 },
          { identifier: 769, port_id: 3, ont_id: 1, ont_name: 'DESA-CIBINONG', name: 'DESA-CIBINONG', ont_sn: 'HSGQ03C12349', sn: 'HSGQ03C12349', rstate: 1, rec_optical_power: -20.15, last_up_time: '2026-09-11 16:50:22', last_down_time: '-', last_down_cause: '-', ont_description: 'Kantor Kelurahan Cibinong', wifiname: 'CIBINONG_WIFI', sharekey: 'cibinong123', securitymode: 4, channel: 6, bandwidth: 1, isolation: 0, broadcast: 1, enable: 1 }
        ]
      };
      return NextResponse.json(mockOltData);
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    let endpoint = '/ontinfo_table';
    if (type === 'Version Information') endpoint = '/ontversion_table';
    else if (type === 'Bind Profile Info') endpoint = '/ontprofile_table';
    else if (type === 'WLAN') endpoint = '/ontwificonfig_table';
    const isExplicitRefresh = searchParams.has('_t') || searchParams.get('force') === 'true';
    if (!isExplicitRefresh && endpoint === '/ontinfo_table' && global.hsgqDataCache && global.hsgqDataCache.ontinfo && (Date.now() - global.hsgqDataCache.timestamp < 15000)) {
      if (global.hsgqDataCache.ontinfo.code === 1 || Array.isArray(global.hsgqDataCache.ontinfo.data)) {
        return NextResponse.json(global.hsgqDataCache.ontinfo);
      }
    }

    const doRequest = async (token, ep = endpoint) => {
      // Trigger HSGQ OLT native hardware refresh across all PON ports
      if (ep === '/ontinfo_table') {
        try {
          await Promise.all([
            axios.get(`${url}/system?form=refreshtab`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/board?info=pon`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/board?info=system`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/gponmgmt?form=gpon_setting`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/gponont_mgmt?form=auth&port_id=0`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/gponont_mgmt?form=auth&port_id=1`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/gponont_mgmt?form=auth&port_id=2`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/gponont_mgmt?form=auth&port_id=3`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
            axios.get(`${url}/system?form=hostname`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {})
          ]);
        } catch (e) {}
      }

      return await axios.get(`${url}${ep}?_t=${Date.now()}`, {
        headers: { ...(token ? { 'x-token': token } : {}) },
        timeout: 10000
      });
    };

    let token = await getHsgqToken();
    let response;
    try {
      response = await doRequest(token);
    } catch (epErr) {
      if (endpoint === '/ontprofile_table') {
        endpoint = '/ontinfo_table';
        response = await doRequest(token);
      } else {
        throw epErr;
      }
    }
    
    if (isTokenError(response?.data)) {
       token = await getHsgqToken(true);
       try {
         response = await doRequest(token);
       } catch (epErr) {
         if (endpoint === '/ontprofile_table') {
           endpoint = '/ontinfo_table';
           response = await doRequest(token);
         } else {
           throw epErr;
         }
       }
    }

    const data = response.data;
    
    // Apply global pending overrides for WLAN
    if (endpoint === '/ontwificonfig_table' && data && data.data) {
      const now = Date.now();
      // Clean up expired ones
      for (const key in global.pendingWifiUpdates) {
        if (now - global.pendingWifiUpdates[key].timestamp > 65000) {
          delete global.pendingWifiUpdates[key];
        }
      }
      
      data.data = data.data.map(row => {
        if (!row.wifi || !row.wifi[0]) return row;
        const wifi = row.wifi[0];
        
        const fields = [
          'enable', 'isolation', 'broadcast', 'wifiname', 'sharekey',
          'securitymode', 'wpaencrypt', 'channel', 'bandwidth', 'beacon',
          'dtim', 'shortgi'
        ];
        fields.forEach(field => {
          const key = `${row.identifier}_${wifi.instance}_${field}`;
          if (global.pendingWifiUpdates[key]) {
            wifi[field] = global.pendingWifiUpdates[key].value;
          }
        });
        
        return row;
      });
    }

    // Apply global pending overrides for Names and Descriptions
    if (endpoint === '/ontinfo_table' && data && data.data) {
      const now = Date.now();
      global.pendingNameUpdates = global.pendingNameUpdates || {};
      // Clean up expired ones (65 seconds)
      for (const key in global.pendingNameUpdates) {
        if (now - global.pendingNameUpdates[key].timestamp > 65000) {
          delete global.pendingNameUpdates[key];
        }
      }
      
      data.data = data.data.map(row => {
        const key = `${row.identifier}`;
        if (global.pendingNameUpdates[key]) {
          row.name = global.pendingNameUpdates[key].ont_name;
          row.ont_name = global.pendingNameUpdates[key].ont_name;
          row.ont_description = global.pendingNameUpdates[key].ont_description;
        }
        return row;
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching HSGQ OLT data:", error.message);
    return NextResponse.json({ error: 'Failed to fetch OLT data' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await resolveAuth(request);
    if (!hasAccess(user, 'devices-hsgq', 'update')) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk mengonfigurasi OLT' }, { status: 403 });
    }
    const url = process.env.HSGQ_OLT_URL;
    if (!url || process.env.DEMO_MODE === 'true') {
      return NextResponse.json({ code: 1, message: 'Operasi berhasil disimulasikan (Demo Mode)' });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'set_wifi') {
      const body = await request.json();
      
      const doPost = async (token) => {
         return await axios.post(`${url}/gponont_mgmt?form=wificonfig`, body, {
            headers: { 'x-token': token, 'Content-Type': 'application/json;charset=UTF-8' },
            timeout: 10000
         });
      };
      
      let token = await getHsgqToken();
      let response = await doPost(token);
      
      if (isTokenError(response?.data)) {
          token = await getHsgqToken(true);
          response = await doPost(token);
      }
      
      // Force OLT to flush/sync its table by calling this specific GET endpoint
      try {
        await axios.get(`${url}/gponont_mgmt?form=wificonfig&port_id=0`, {
          headers: { 'x-token': token },
          timeout: 5000
        });
      } catch (e) {
        console.warn("Failed to trigger OLT table flush:", e.message);
      }
      
      if (response.data && response.data.code === 1) {
        // Record pending update
        const id = body.param.identifier;
        const inst = body.param.instance;
        const fields = [
          'enable', 'isolation', 'broadcast', 'wifiname', 'sharekey',
          'securitymode', 'wpaencrypt', 'channel', 'bandwidth', 'beacon',
          'dtim', 'shortgi'
        ];
        if (id && inst) {
          fields.forEach(field => {
            if (body.param[field] !== undefined) {
              const key = `${id}_${inst}_${field}`;
              global.pendingWifiUpdates[key] = {
                value: body.param[field],
                timestamp: Date.now()
              };
              
              if (global.io) {
                global.io.emit('hsgq_wifi_update', {
                  identifier: id,
                  instance: inst,
                  field: field,
                  value: body.param[field]
                });
              }
            }
          });
        }
      }
      
      return NextResponse.json(response.data);
    }

    if (action === 'set_info') {
      const body = await request.json();
      
      const doPost = async (token) => {
         return await axios.post(`${url}/gponont_mgmt?form=info`, body, {
            headers: { 'x-token': token, 'Content-Type': 'application/json;charset=UTF-8' },
            timeout: 10000
         });
      };
      
      let token = await getHsgqToken();
      let response = await doPost(token);
      
      if (isTokenError(response?.data)) {
          token = await getHsgqToken(true);
          response = await doPost(token);
      }
      
      if (response.data && response.data.code === 1) {
        const id = body.param?.identifier;
        if (id !== undefined) {
          const key = `${id}`;
          global.pendingNameUpdates = global.pendingNameUpdates || {};
          global.pendingNameUpdates[key] = {
            ont_name: body.param.ont_name,
            ont_description: body.param.ont_description,
            timestamp: Date.now()
          };
        }
      }
      
      return NextResponse.json(response.data);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error("Error posting to HSGQ OLT:", error.message);
    return NextResponse.json({ error: 'Failed to update OLT data' }, { status: 500 });
  }
}
