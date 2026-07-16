import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting + security headers + body size guard.
 * Edge middleware on /api/:path*.
 */

// In-memory rate limiter (per-process; resets on deploy — fine for MVP)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_MAP_SIZE = 10_000;

const RATE_LIMITS: Record<string, number> = {
  '/api/v1/run': 60,
  '/api/v1/deposit': 10,
  '/api/faucet': 5,
};
const DEFAULT_RATE_LIMIT = 120;
const WINDOW_MS = 60_000;

// Body size limits (bytes)
const BODY_LIMITS: Record<string, number> = {
  '/api/v1/run': 1_048_576, // 1 MB
};
const DEFAULT_BODY_LIMIT = 102_400; // 100 KB

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Extract client IP. Prefer platform-specific headers that can't be spoofed,
 * fall back to last entry in X-Forwarded-For (the one added by our trusted proxy),
 * then X-Real-IP, then 'unknown'.
 */
function getClientIp(req: NextRequest): string {
  // Platform-specific headers (set by reverse proxy, not spoofable by client)
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0]!.trim();

  // X-Forwarded-For: use the rightmost (last proxy-appended) entry.
  // The leftmost is client-controlled and trivially spoofed.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return req.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

function getRateLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return DEFAULT_RATE_LIMIT;
}

function getBodyLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(BODY_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return DEFAULT_BODY_LIMIT;
}

/** Evict stale entries when map exceeds threshold */
function evictStaleEntries(now: number) {
  if (rateLimitMap.size <= MAX_MAP_SIZE) return;
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Rate limiting ---
  const ip = getClientIp(req);
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const limit = getRateLimit(pathname);

  evictStaleEntries(now);

  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
  } else {
    entry.count++;
    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
      return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  // --- Body size guard (POST/PUT/PATCH only) ---
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const clHeader = req.headers.get('content-length');
    const bodyLimit = getBodyLimit(pathname);

    if (clHeader) {
      if (Number(clHeader) > bodyLimit) {
        return new NextResponse(
          JSON.stringify({ error: 'Request body too large' }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
          },
        );
      }
    } else {
      // No Content-Length header (chunked encoding) — reject to prevent bypass.
      // API endpoints expect JSON bodies which always have Content-Length.
      return new NextResponse(
        JSON.stringify({ error: 'Content-Length header required' }),
        {
          status: 411,
          headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
        },
      );
    }
  }

  // --- Attach security headers ---
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: '/api/:path*',
};

// Exported for testing
export { rateLimitMap, WINDOW_MS, MAX_MAP_SIZE, getRateLimit, getClientIp, evictStaleEntries };
