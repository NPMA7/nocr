import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import { verifyAuth, sendApiError } from '@/lib/auth';

const execAsync = util.promisify(exec);

export async function GET(req) {
  try {
    verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const host = searchParams.get('host') || searchParams.get('ip');

    if (!host) {
      return NextResponse.json({ error: 'Parameter host/ip diperlukan' }, { status: 400 });
    }

    // Sanitasi input: hanya izinkan karakter IP / hostname valid
    const cleanHost = host.trim();
    if (!/^[0-9a-zA-Z.:-]+$/.test(cleanHost)) {
      return NextResponse.json({ error: 'Format host/ip tidak valid' }, { status: 400 });
    }

    const count = Math.min(Math.max(parseInt(searchParams.get('count')) || 4, 1), 10);
    const timeout = Math.min(Math.max(parseInt(searchParams.get('timeout')) || 2, 1), 5);

    let stdout = '';
    let stderr = '';
    let alive = false;
    let packetLoss = 100;
    let avgTime = null;
    let minTime = null;
    let maxTime = null;

    try {
      const res = await execAsync(`ping -c ${count} -W ${timeout} ${cleanHost}`);
      stdout = res.stdout;
      stderr = res.stderr;
      alive = true;
    } catch (err) {
      // ping keluar dengan exit code > 0 jika ada packet loss 100% atau unreachable
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || '';
      alive = false;
    }

    // Parse packet loss
    const lossMatch = stdout.match(/(\d+(?:\.\d+)?)%\s+packet\s+loss/i);
    if (lossMatch) {
      packetLoss = parseFloat(lossMatch[1]);
      if (packetLoss < 100) {
        alive = true;
      }
    }

    // Parse RTT min/avg/max/mdev
    const rttMatch = stdout.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)/i);
    if (rttMatch) {
      minTime = parseFloat(rttMatch[1]);
      avgTime = parseFloat(rttMatch[2]);
      maxTime = parseFloat(rttMatch[3]);
    }

    return NextResponse.json({
      host: cleanHost,
      alive,
      packetLoss,
      avgTime,
      minTime,
      maxTime,
      output: stdout.trim() || stderr.trim(),
    });
  } catch (error) {
    return sendApiError(error);
  }
}

export async function POST(req) {
  try {
    verifyAuth(req);

    const body = await req.json().catch(() => ({}));
    const host = body.host || body.ip;

    if (!host) {
      return NextResponse.json({ error: 'Parameter host/ip diperlukan' }, { status: 400 });
    }

    const cleanHost = host.trim();
    if (!/^[0-9a-zA-Z.:-]+$/.test(cleanHost)) {
      return NextResponse.json({ error: 'Format host/ip tidak valid' }, { status: 400 });
    }

    const count = Math.min(Math.max(parseInt(body.count) || 4, 1), 10);
    const timeout = Math.min(Math.max(parseInt(body.timeout) || 2, 1), 5);

    let stdout = '';
    let stderr = '';
    let alive = false;
    let packetLoss = 100;
    let avgTime = null;
    let minTime = null;
    let maxTime = null;

    try {
      const res = await execAsync(`ping -c ${count} -W ${timeout} ${cleanHost}`);
      stdout = res.stdout;
      stderr = res.stderr;
      alive = true;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || '';
      alive = false;
    }

    const lossMatch = stdout.match(/(\d+(?:\.\d+)?)%\s+packet\s+loss/i);
    if (lossMatch) {
      packetLoss = parseFloat(lossMatch[1]);
      if (packetLoss < 100) {
        alive = true;
      }
    }

    const rttMatch = stdout.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([0-9.]+)\/([0-9.]+)\/([0-9.]+)/i);
    if (rttMatch) {
      minTime = parseFloat(rttMatch[1]);
      avgTime = parseFloat(rttMatch[2]);
      maxTime = parseFloat(rttMatch[3]);
    }

    return NextResponse.json({
      host: cleanHost,
      alive,
      packetLoss,
      avgTime,
      minTime,
      maxTime,
      output: stdout.trim() || stderr.trim(),
    });
  } catch (error) {
    return sendApiError(error);
  }
}

