/**
 * GET /api/cron/reconcile-bsc-settle
 *
 * Vercel Cron entry point for BSC settle reconciliation. Wrapped around the
 * shared `reconcilePendingBscSettle()` core in `src/lib/bsc-reconcile.ts`
 * so that the Vercel cron and the local CLI script
 * (`scripts/reconcile-pending-bsc-settle.ts`) run identical logic.
 *
 * Scheduled in `vercel.json`:
 *   { "path": "/api/cron/reconcile-bsc-settle", "schedule": "* /5 * * * *" }
 *
 * Auth: Vercel cron injects `Authorization: Bearer ${CRON_SECRET}`. We verify
 * it against `process.env.CRON_SECRET`. Requests without the header (or with
 * the wrong value) get 401.
 *
 * Response 200:
 *   { ok: true, stats: ReconcileStats }
 *
 * Response 401:
 *   { error: 'unauthorized' }
 *
 * Response 500:
 *   { error: string }  // reconcile never throws, but the auth/env check can
 *
 * Related:
 *   - src/lib/bsc-reconcile.ts          (shared core)
 *   - scripts/reconcile-pending-bsc-settle.ts  (CLI wrapper)
 *   - src/app/api/sessions/[id]/close/route.ts (the deferrer)
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reconcilePendingBscSettle } from '@/lib/bsc-reconcile';

export const dynamic = 'force-dynamic';

// Vercel Hobby serverless timeout is 10s; Pro is 60s. Reconcile touches
// up to 25 sessions × (DB read + 1 on-chain read + optional settle tx),
// so give it room. Max for Hobby is 60s since Dec 2024.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Auth: Vercel cron header or manual invoke with bearer token.
  const authHeader = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error('[cron/reconcile-bsc-settle] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  // Constant-time comparison prevents timing oracle attacks on the secret.
  const authBuf = Buffer.from(authHeader ?? '');
  const expectedBuf = Buffer.from(`Bearer ${expected}`);
  const authorized =
    authBuf.length === expectedBuf.length &&
    timingSafeEqual(authBuf, expectedBuf);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await reconcilePendingBscSettle();
    return NextResponse.json({ ok: true, stats });
  } catch (err: unknown) {
    // reconcilePendingBscSettle() shouldn't throw, but belt-and-suspenders
    // so a bug in the reconciler doesn't spam 500s into Vercel's cron log.
    console.error('[cron/reconcile-bsc-settle] unexpected error:', err);
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
}
