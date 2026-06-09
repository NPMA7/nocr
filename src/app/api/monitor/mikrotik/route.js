import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';

export async function GET() {
  try {
    const [secretsResult, activeResult] = await Promise.all([
      db.from('pppoe_secrets').select('name, service, disabled'),
      db.from('pppoe_active').select('name, address, uptime')
    ]);

    if (secretsResult.error) throw secretsResult.error;
    if (activeResult.error) throw activeResult.error;

    return NextResponse.json({
      secrets: secretsResult.data || [],
      pppoe: activeResult.data || []
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
