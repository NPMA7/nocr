import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    const url = process.env.HSGQ_OLT_URL;
    if (!url) {
      return NextResponse.json({ error: 'HSGQ_OLT_URL is not configured' }, { status: 500 });
    }

    const response = await axios.get(`${url}/ontinfo_table`, {
      timeout: 10000 // 10 seconds timeout
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error("Error fetching HSGQ OLT data:", error.message);
    return NextResponse.json({ error: 'Failed to fetch OLT data' }, { status: 500 });
  }
}
