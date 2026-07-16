import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { settleSession } from '@/lib/settle-session';
import { parseBody, v1CloseInput } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/close
 *
 * Manual session close for REST API users.
 * Auth: Bearer API key (same as /api/v1/run).
 *
 * Body: { session_id: string }
 *
 * Response 200: {
 *   session: { id, status, pass_rate, settled_onchain, bas_uid, ... }
 * }
 */
export async function POST(req: NextRequest) {
  // --- Auth: Bearer API key ---
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization: Bearer <api_key>' },
      { status: 401 },
    );
  }
  const apiKey = auth.slice(7).trim();

  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // --- Parse body ---
  const parsed = await parseBody(req, v1CloseInput);
  if (!parsed.success) return parsed.response;
  const { session_id: sessionId } = parsed.data;

  // --- Verify session exists + ownership ---
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { agent: true },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.agent.ownerId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden — not owner of this session' },
      { status: 403 },
    );
  }

  // Idempotency — already terminal
  if (session.status === 'settled' || session.status === 'refunded') {
    const existing = await prisma.session.findUnique({ where: { id: sessionId } });
    return NextResponse.json({
      session: buildCloseResponse(existing ?? session),
    });
  }

  // State guard
  if (session.status !== 'funded' && session.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot close session in status '${session.status}'` },
      { status: 409 },
    );
  }

  // --- Settle ---
  const result = await settleSession(sessionId);

  // Re-read for final state
  const updated = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!updated) {
    return NextResponse.json({ error: 'Session not found after close' }, { status: 404 });
  }

  return NextResponse.json({
    session: buildCloseResponse(updated),
    settlement: {
      pass_rate: result.passRate,
      total_calls: result.totalCalls,
      settled_onchain: !!result.onchainJobId,
      bas_uid: result.basAttestationUid,
    },
  });
}

function buildCloseResponse(session: {
  id: string;
  status: string;
  budgetTotal: number;
  budgetRemaining: number;
  pricePerCall: number;
  callCount: number;
  openedAt: Date;
  expiresAt: Date;
  settledAt: Date | null;
  skillId: string;
  onchainJobId: string | null;
  basAttestationUid: string | null;
}) {
  return {
    id: session.id,
    status: session.status,
    budget_total: session.budgetTotal,
    budget_remaining: session.budgetRemaining,
    price_per_call: session.pricePerCall,
    call_count: session.callCount,
    opened_at: session.openedAt.toISOString(),
    expires_at: session.expiresAt.toISOString(),
    settled_at: session.settledAt?.toISOString() ?? null,
    skill_id: session.skillId,
    onchain_job_id: session.onchainJobId,
    bas_uid: session.basAttestationUid,
  };
}
