import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { evaluateCall } from '@/lib/session-evaluator';

export const dynamic = 'force-dynamic';

const DRY_RUN_TIMEOUT_MS = 8_000;

/**
 * POST /api/skills/dry-run
 *
 * Stateless pre-publish sandbox. Calls the creator endpoint,
 * runs evaluateCall(), returns results. No skill record required.
 *
 * Body: { endpointUrl, input, authHeader? }
 * Auth: Privy JWT (dev bypass with DOJO_SKIP_PRIVY_AUTH).
 */
export async function POST(req: NextRequest) {
  try {
    const skipAuth =
      process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (!skipAuth) {
      const auth = await verifyPrivyAuth(req.headers.get('Authorization'));
      if (!auth.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { endpointUrl, input, authHeader } = body;

    if (!endpointUrl) {
      return NextResponse.json(
        { error: 'Missing required field: endpointUrl' },
        { status: 400 }
      );
    }

    // Validate URL — block SSRF vectors
    let parsed: URL;
    try {
      parsed = new URL(endpointUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid endpointUrl' },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Scheme: https always; http only in dev (for localhost testing)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && !isProduction)) {
      return NextResponse.json(
        { error: 'endpointUrl must use https' },
        { status: 400 }
      );
    }

    // Block private/internal IPs in production (SSRF guard)
    if (isProduction) {
      const hostname = parsed.hostname.toLowerCase();
      const BLOCKED = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,   // link-local / cloud metadata
        /^::1$/,         // IPv6 loopback
        /^fc00:/,        // ULA fc00::/8
        /^fd/,           // ULA fd00::/8 (fc00::/7 covers both fc and fd)
        /^fe[89ab][0-9a-f]:/i, // link-local fe80::/10
      ];
      if (BLOCKED.some((rx) => rx.test(hostname))) {
        return NextResponse.json(
          { error: 'endpointUrl targets a private address' },
          { status: 400 }
        );
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DRY_RUN_TIMEOUT_MS);

    let httpStatus = 0;
    let responseBody = '';
    let failed = false;
    const t0 = Date.now();

    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(input ?? {}),
        signal: controller.signal,
      });
      httpStatus = res.status;
      responseBody = await res.text();
    } catch (err) {
      failed = true;
      if (err instanceof DOMException && err.name === 'AbortError') {
        responseBody = 'Request timed out';
      } else {
        responseBody = err instanceof Error ? err.message : 'Network error';
      }
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - t0;
    const evalResult = evaluateCall(httpStatus, responseBody, latencyMs, failed);

    // Parse response data for display
    let data: unknown = null;
    if (!failed && responseBody) {
      try {
        data = JSON.parse(responseBody);
      } catch {
        data = responseBody;
      }
    }

    return NextResponse.json({
      ok: evalResult.score === 1.0,
      status: httpStatus,
      latencyMs,
      data,
      eval: {
        score: evalResult.score,
        delivered: evalResult.delivered,
        validFormat: evalResult.validFormat,
        withinSla: evalResult.withinSla,
      },
    });
  } catch (err) {
    console.error('[POST /api/skills/dry-run]', err);
    const message = err instanceof Error ? err.message : 'Dry run failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
