import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    const url = process.env.HSGQ_OLT_URL;
    if (!url) {
      return NextResponse.json({ error: 'HSGQ_OLT_URL is not configured' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const endpoint = type === 'Version Information' ? '/ontversion_table' : '/ontinfo_table';

    const response = await axios.get(`${url}${endpoint}`, {
      timeout: 10000 // 10 seconds timeout
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error fetching HSGQ OLT data:", error.message);
    return NextResponse.json({ error: 'Failed to fetch OLT data' }, { status: 500 });
  }
}
