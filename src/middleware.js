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
         pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|css|js|map|woff|woff2|ttf)$/i);
}

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
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

  // If trying to access /login while already having a valid token
  if (pathname === '/login') {
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      } catch (e) {}
    }
    return NextResponse.next();
  }

  // If public route, allow
  if (isPublic) {
    return NextResponse.next();
  }

  // If no token on protected page or protected API route
  let isTokenValid = false;
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          isTokenValid = true;
        }
      }
    } catch (e) {
      isTokenValid = false;
    }
  }

  if (!isTokenValid) {
    // If it's an API route, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Token tidak ditemukan atau kedaluwarsa' },
        { status: 401 }
      );
    }

    // For page routes, redirect to /login
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.set('nocr_token', '', { path: '/', maxAge: 0 });
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
