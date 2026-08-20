import { NextResponse } from 'next/server';
import axios from 'axios';
import { verifyAuth, sendApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    // Silently handle
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
      const [baseRes, capRes, verRes, optRes] = await Promise.all([
        axios.get(`${url}/gponont_mgmt?form=base&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 }),
        axios.get(`${url}/gponont_mgmt?form=capability&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 }),
        axios.get(`${url}/gponont_mgmt?form=ont_version&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 }),
        axios.get(`${url}/gponont_mgmt?form=ont_optical&port_id=${port_id}&ont_id=${ont_id}`, { headers, timeout: 10000 })
      ]);
      
      return {
        base: baseRes.data,
        capability: capRes.data,
        version: verRes.data,
        optical: optRes.data
      };
    };

    let token = await getHsgqToken();
    let data = await doRequests(token);
    
    // Check if token expired on the first request (base)
    if (!data.base || isTokenError(data.base)) {
       token = await getHsgqToken(true);
       data = await doRequests(token);
    }
    
    // Apply global pending overrides for Names and Descriptions
    const identifier = (Number(port_id) << 8) | Number(ont_id);
    const key = `${identifier}`;
    global.pendingNameUpdates = global.pendingNameUpdates || {};
    if (global.pendingNameUpdates[key] && data.base && data.base.data && data.base.data[0]) {
      const row = data.base.data[0];
      row.name = global.pendingNameUpdates[key].ont_name;
      row.ont_name = global.pendingNameUpdates[key].ont_name;
      row.ont_description = global.pendingNameUpdates[key].ont_description;
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    return sendApiError(error);
  }
}
