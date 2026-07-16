import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sessions?privyId=...&skillId=...&status=settled,refunded
 *
 * Returns user's sessions for a skill, filtered by status.
 * Used by ReviewForm to check receipt eligibility.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const privyId = searchParams.get('privyId');
  const skillId = searchParams.get('skillId');
  const statusFilter = searchParams.get('status')?.split(',') ?? ['settled', 'refunded'];

  if (!privyId || !skillId) {
    return NextResponse.json({ error: 'privyId and skillId required' }, { status: 400 });
  }

  // Auth check
  const skipAuth =
    process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production';

  if (!skipAuth) {
    const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
    if (!authResult.success || authResult.privyId !== privyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Find user by privyId
  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json({ sessions: [], userId: undefined });
  }

  // Find user's agents
  const agents = await prisma.agent.findMany({
    where: { ownerId: user.id },
    select: { id: true },
  });
  const agentIds = agents.map((a) => a.id);

  if (agentIds.length === 0) {
    return NextResponse.json({ sessions: [], userId: user.id });
  }

  const sessions = await prisma.session.findMany({
    where: {
      skillId,
      payerAgentId: { in: agentIds },
      status: { in: statusFilter },
    },
    orderBy: { settledAt: 'desc' },
    take: 20,
    select: {
      id: true,
      callCount: true,
      status: true,
      settledAt: true,
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      callCount: s.callCount,
      status: s.status,
      settledAt: s.settledAt?.toISOString() ?? null,
    })),
    userId: user.id,
  });
}
