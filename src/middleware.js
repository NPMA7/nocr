import { NextResponse } from 'next/server';

// Public page routes and public API routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/status',
  '/api/auth/check-setup',
  '/api/auth/logout',
];

const STATIC_PREFIXES = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/logo.png',
  '/robots.txt',
  '/manifest.json',
];

function isStaticPath(pathname) {
  return STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix)) || 
         pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|css|js|map|woff|woff2|ttf|json)$/i);
}

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

// In-Memory Rate Limiter has been centralized in server.js via express-rate-limit

function getClientIp(req) {
  const getHeader = (name) => {
    return req.headers.get(name) || req.headers.get(name.toLowerCase());
  };

  const cfConnectingIp = getHeader('cf-connecting-ip');
  if (cfConnectingIp) return String(cfConnectingIp).trim();

  const trueClientIp = getHeader('true-client-ip');
  if (trueClientIp) return String(trueClientIp).trim();

  const xRealIp = getHeader('x-real-ip');
  if (xRealIp) return String(xRealIp).trim();

  const forwarded = getHeader('x-forwarded-for');
  if (forwarded) {
    const ips = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }

  return req.ip || '127.0.0.1';
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  // Extract token from cookie or Authorization header
  let token = request.cookies.get('nocr_token')?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1].trim();
    }
  }

  const isPublic = isPublicPath(pathname);

  // Decode payload if token exists
  let tokenPayload = null;
  let isTokenValid = false;
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        tokenPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (tokenPayload.exp && tokenPayload.exp * 1000 > Date.now()) {
          isTokenValid = true;
        }
      }
    } catch (e) {
      isTokenValid = false;
      tokenPayload = null;
    }
  }

  // If public route (including /login), allow immediately
  if (isPublic) {
    return NextResponse.next();
  }

  // If no token on protected page or protected API route
  if (!isTokenValid) {
    // Check if API Key header or query param exists for /api/ routes
    if (pathname.startsWith('/api/')) {
      const hasApiKey = request.headers.get('x-api-key') ||
                        request.headers.get('x-api-token') ||
                        request.nextUrl.searchParams.get('api_key') ||
                        request.nextUrl.searchParams.get('apiKey') ||
                        request.headers.get('authorization')?.startsWith('Bearer nocr_');

      if (hasApiKey) {
        // Enforce STRICT Read-Only (GET / HEAD only) for API Keys
        if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
          return NextResponse.json(
            { error: 'Akses Ditolak: API Key bersifat Read-Only (Hanya HTTP GET).' },
            { status: 403 }
          );
        }
        return NextResponse.next();
      }

      return NextResponse.json(
        { error: 'Akses Ditolak: Token atau API Key tidak ditemukan atau kedaluwarsa' },
        { status: 401 }
      );
    }

    // For page routes, redirect to /login
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
      response.cookies.set({
        name: 'nocr_token',
        value: '',
        path: '/',
        maxAge: 0,
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax'
      });
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

