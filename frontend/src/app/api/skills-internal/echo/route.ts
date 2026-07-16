import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills-internal/echo
 *
 * Echo test skill — returns the request body with a server timestamp and latency.
 * Used for E2E testing of the gateway + session + evaluator pipeline.
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const latencyMs = Date.now() - t0;

  return NextResponse.json({
    echo: body,
    latency_ms: latencyMs,
    server_ts: new Date().toISOString(),
  });
}
