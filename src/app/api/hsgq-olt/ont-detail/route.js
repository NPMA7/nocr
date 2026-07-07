import { NextResponse } from 'next/server';
import axios from 'axios';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

if (!global.hsgqTokenCache) {
  global.hsgqTokenCache = null;
}

async function getHsgqToken(forceRefresh = false) {
  if (!forceRefresh && global.hsgqTokenCache) return global.hsgqTokenCache;
  
  const url = process.env.HSGQ_OLT_URL;
  const username = process.env.HSGQ_OLT_USERNAME;
  const key = process.env.HSGQ_OLT_KEY;
  const value = process.env.HSGQ_OLT_VALUE;
  
  if (!username || !key || !value) {
    return process.env.HSGQ_OLT_TOKEN || '';
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
      return global.hsgqTokenCache;
    }
  } catch (e) {
    // Silently handle
  }
  
  return process.env.HSGQ_OLT_TOKEN || '';
}

export async function GET(request) {
  try {
    verifyAuth(request);
    const url = process.env.HSGQ_OLT_URL;
    if (!url) {
      return NextResponse.json({ error: 'HSGQ_OLT_URL is not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const port_id = searchParams.get('port_id');
    const ont_id = searchParams.get('ont_id');
    
    if (port_id == null || ont_id == null) {
      return NextResponse.json({ error: 'port_id and ont_id are required' }, { status: 400 });
    }

    const doRequests = async (token) => {
      const headers = { 'x-token': token };
      const [baseRes, capRes, verRes] = await Promise.all([
        axios.get(`${url}/gponont_mgmt?form=base&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 }),
        axios.get(`${url}/gponont_mgmt?form=capability&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 }),
        axios.get(`${url}/gponont_mgmt?form=ont_version&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 })
      ]);
      
      return {
        base: baseRes.data,
        capability: capRes.data,
        version: verRes.data
      };
    };

    let token = await getHsgqToken();
    let data = await doRequests(token);
    
    // Check if token expired on the first request (base)
    if (data.base && data.base.code === 0 && data.base.message === 'Token Check Failed') {
       token = await getHsgqToken(true);
       data = await doRequests(token);
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching ONT details:', error?.message);
    if (error.response) {
       console.error('Data:', error.response.data);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
