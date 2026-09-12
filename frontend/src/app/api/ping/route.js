import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';
import net from 'net';
import { resolveAuth, sendApiError } from '@/lib/auth';
import { isLegacyAdmin } from '@/lib/roles';

const execFileAsync = util.promisify(execFile);

// Per-user/IP rate limit for diagnostic ping (15 pings per minute)
const pingRateLimits = new Map();
const PING_WINDOW_MS = 60 * 1000;
const MAX_PINGS_PER_MINUTE = 15;

function checkPingRateLimit(key) {
  const now = Date.now();
  const history = (pingRateLimits.get(key) || []).filter(t => now - t < PING_WINDOW_MS);
  if (history.length >= MAX_PINGS_PER_MINUTE) {
    const retryAfter = Math.ceil((history[0] + PING_WINDOW_MS - now) / 1000);
    return { limited: true, retryAfter: Math.max(1, retryAfter) };
  }
  history.push(now);
  pingRateLimits.set(key, history);
  return { limited: false };
}

function isDisallowedTarget(target) {
  const lower = target.toLowerCase().trim();

  // Localhost aliases
  if (lower === 'localhost' || lower === 'ip6-localhost' || lower === 'ip6-loopback') {
    return 'Target localhost/loopback tidak diizinkan';
  }

  // IPv6 checks
  if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
    return 'Target IPv6 loopback / link-local / ULA tidak diizinkan';
  }

  // IPv4 checks
  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    const [b0, b1, b2, b3] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) {
      return 'Target host 0.0.0.0/8 tidak diizinkan';
    }

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) {
      return 'Target IP loopback (127.0.0.0/8) tidak diizinkan';
    }

    // 169.254.0.0/16 (Link-Local & Cloud Instance Metadata e.g. 169.254.169.254)
    if (b0 === 169 && b1 === 254) {
      return 'Target IP Link-local / Cloud Metadata (169.254.0.0/16) tidak diizinkan';
    }

    // 224.0.0.0/4 (Multicast) and 240.0.0.0/4 (Reserved) & 255.255.255.255 (Broadcast)
    if (b0 >= 224) {
      return 'Target IP Multicast / Broadcast tidak diizinkan';
    }
  }

  return null;
}

async function handlePing(target, countParam, timeoutParam, user, clientKey) {
  if (!target) {
    return NextResponse.json({ error: 'Parameter host/ip diperlukan' }, { status: 400 });
  }

  const cleanHost = String(target).trim();

  // Strict format validation (IPv4, IPv6, or domain name)
  if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$|^[a-zA-Z0-9-]+$/.test(cleanHost)) {
    return NextResponse.json({ error: 'Format host/ip tidak valid' }, { status: 400 });
  }

  // SSRF prevention checks
  const disallowedError = isDisallowedTarget(cleanHost);
  if (disallowedError) {
    return NextResponse.json({ error: disallowedError }, { status: 400 });
  }

  // Rate limit check
  const rateResult = checkPingRateLimit(clientKey);
  if (rateResult.limited) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan ping. Silakan coba lagi dalam ${rateResult.retryAfter} detik.` },
      {
        status: 429,
        headers: { 'Retry-After': String(rateResult.retryAfter) }
      }
    );
  }

  const count = Math.min(Math.max(parseInt(countParam, 10) || 4, 1), 10);
  const timeout = Math.min(Math.max(parseInt(timeoutParam, 10) || 2, 1), 5);

  let stdout = '';
  let alive = false;
  let packetLoss = 100;
  let avgTime = null;
  let minTime = null;
  let maxTime = null;

  try {
    // Use execFile with explicit argument array to eliminate shell injection entirely
    const res = await execFileAsync('ping', ['-c', String(count), '-W', String(timeout), cleanHost]);
    stdout = res.stdout || '';
    alive = true;
  } catch (err) {
    stdout = err.stdout || err.stderr || err.message || '';
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

  const cleanOutput = stdout.trim() || (alive
    ? `PING ${cleanHost}: ${count} packets transmitted, ${packetLoss}% packet loss`
    : `PING ${cleanHost}: Request timed out (100% packet loss)`);

  return NextResponse.json({
    host: cleanHost,
    alive,
    packetLoss,
    avgTime,
    minTime,
    maxTime,
    output: cleanOutput,
  });
}

function verifyPingRole(user) {
  if (isLegacyAdmin(user)) return true;
  const role = (user?.role || '').toLowerCase().trim();
  // Allowed NOC diagnostic operator roles
  if (['admin', 'superadmin', 'teknisi', 'eos', 'manage'].includes(role)) {
    return true;
  }
  return false;
}

export async function GET(req) {
  try {
    const user = await resolveAuth(req);

    if (!verifyPingRole(user)) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Role Anda tidak memiliki izin untuk melakukan diagnosis jaringan' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const host = searchParams.get('host') || searchParams.get('ip');
    const clientKey = `${user.id || 'anon'}_${req.headers.get('x-forwarded-for') || 'local'}`;

    return await handlePing(host, searchParams.get('count'), searchParams.get('timeout'), user, clientKey);
  } catch (error) {
    return sendApiError(error);
  }
}

export async function POST(req) {
  try {
    const user = await resolveAuth(req);

    if (!verifyPingRole(user)) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Role Anda tidak memiliki izin untuk melakukan diagnosis jaringan' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const host = body.host || body.ip;
    const clientKey = `${user.id || 'anon'}_${req.headers.get('x-forwarded-for') || 'local'}`;

    return await handlePing(host, body.count, body.timeout, user, clientKey);
  } catch (error) {
    return sendApiError(error);
  }
}
