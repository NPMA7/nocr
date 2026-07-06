import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Global object to track pending updates across all users
if (!global.pendingWifiUpdates) {
  global.pendingWifiUpdates = {};
}

export async function GET(request) {
  try {
    const url = process.env.HSGQ_OLT_URL;
    if (!url) {
      return NextResponse.json({ error: 'HSGQ_OLT_URL is not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    let endpoint = '/ontinfo_table';
    if (type === 'Version Information') endpoint = '/ontversion_table';
    else if (type === 'Bind Profile Info') endpoint = '/ontprofile_table';
    else if (type === 'WLAN') endpoint = '/ontwificonfig_table';
    const token = process.env.HSGQ_OLT_TOKEN;
    const response = await axios.get(`${url}${endpoint}?_t=${Date.now()}`, {
      headers: {
        ...(token ? { 'x-token': token } : {})
      },
      timeout: 10000 // 10 seconds timeout
    });

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
        
        ['enable', 'isolation', 'broadcast'].forEach(field => {
          const key = `${row.identifier}_${wifi.instance}_${field}`;
          if (global.pendingWifiUpdates[key]) {
            wifi[field] = global.pendingWifiUpdates[key].value;
          }
        });
        
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
    const url = process.env.HSGQ_OLT_URL;
    if (!url) {
      return NextResponse.json({ error: 'HSGQ_OLT_URL is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'set_wifi') {
      const body = await request.json();
      const token = process.env.HSGQ_OLT_TOKEN;
      
      const response = await axios.post(`${url}/gponont_mgmt?form=wificonfig`, body, {
        headers: {
          'x-token': token,
          'Content-Type': 'application/json;charset=UTF-8'
        },
        timeout: 10000
      });
      
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
        if (id && inst) {
          ['enable', 'isolation', 'broadcast'].forEach(field => {
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error("Error posting to HSGQ OLT:", error.message);
    return NextResponse.json({ error: 'Failed to update OLT data' }, { status: 500 });
  }
}
