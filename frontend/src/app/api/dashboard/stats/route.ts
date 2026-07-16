import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 *
 * Returns aggregated dashboard stats for the authenticated user.
 * Auto-detects role (creator vs agent) based on data.
 *
 * Auth: Bearer token (Privy JWT) — or privyId query param in dev bypass mode.
 */
export async function GET(req: NextRequest) {
  const skipAuth =
    process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production';

  let privyId: string;

  if (skipAuth) {
    const qPrivyId = req.nextUrl.searchParams.get('privyId');
    if (!qPrivyId) {
      return NextResponse.json({ error: 'Missing privyId query param (dev mode)' }, { status: 400 });
    }
    privyId = qPrivyId;
  } else {
    const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
    if (!authResult.success || !authResult.privyId) {
      return NextResponse.json(
        { error: authResult.error ?? 'Authentication required' },
        { status: 401 }
      );
    }
    privyId = authResult.privyId;
  }

  const user = await prisma.user.findUnique({
    where: { privyId },
    select: { id: true, displayName: true, walletAddress: true, erc8004TokenId: true, kyaLevel: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const walletAddress = user.walletAddress;

  // Creator stats: skills they created + sessions against those skills
  const createdSkills = await prisma.skill.findMany({
    where: { creatorId: user.id },
    select: {
      id: true, name: true, gatewaySlug: true, pricePerCall: true,
      sessions: {
        select: {
          id: true, status: true, budgetTotal: true, budgetRemaining: true,
          callCount: true, pricePerCall: true, settledAt: true, basAttestationUid: true,
          openedAt: true,
          agent: { select: { name: true, walletAddress: true, trustScore: true } },
        },
        orderBy: { openedAt: 'desc' },
        take: 50,
      },
    },
  });

  // Agent stats: agents they own + sessions from those agents
  const ownedAgents = await prisma.agent.findMany({
    where: { ownerId: user.id },
    select: {
      id: true, name: true, walletAddress: true, trustScore: true,
      sessions: {
        select: {
          id: true, status: true, budgetTotal: true, budgetRemaining: true,
          callCount: true, pricePerCall: true, settledAt: true, basAttestationUid: true,
          openedAt: true,
          skill: { select: { name: true, gatewaySlug: true } },
        },
        orderBy: { openedAt: 'desc' },
        take: 50,
      },
    },
  });

  // Compute aggregates
  const allCreatorSessions = createdSkills.flatMap((s) => s.sessions);
  const allAgentSessions = ownedAgents.flatMap((a) => a.sessions);

  const creatorEarnings = allCreatorSessions
    .filter((s) => s.status === 'settled')
    .reduce((sum, s) => sum + (s.budgetTotal - s.budgetRemaining), 0);

  const agentSpent = allAgentSessions
    .reduce((sum, s) => sum + (s.budgetTotal - s.budgetRemaining), 0);

  const creatorSessionCount = allCreatorSessions.length;
  const agentSessionCount = allAgentSessions.length;

  const creatorCallCount = allCreatorSessions.reduce((sum, s) => sum + s.callCount, 0);
  const agentCallCount = allAgentSessions.reduce((sum, s) => sum + s.callCount, 0);

  const role = createdSkills.length > 0 ? 'creator' : 'agent';

  return NextResponse.json({
    user: {
      displayName: user.displayName,
      walletAddress,
      erc8004TokenId: user.erc8004TokenId?.toString() ?? null,
      kyaLevel: user.kyaLevel,
    },
    role,
    creator: {
      skillCount: createdSkills.length,
      totalEarnings: parseFloat(creatorEarnings.toFixed(6)),
      sessionCount: creatorSessionCount,
      callCount: creatorCallCount,
      skills: createdSkills.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.gatewaySlug,
        pricePerCall: s.pricePerCall,
        sessionCount: s.sessions.length,
      })),
      recentSessions: allCreatorSessions.slice(0, 20),
    },
    agent: {
      agents: ownedAgents.map((a) => ({
        id: a.id,
        name: a.name,
        walletAddress: a.walletAddress,
        trustScore: a.trustScore,
        sessionCount: a.sessions.length,
      })),
      totalSpent: parseFloat(agentSpent.toFixed(6)),
      sessionCount: agentSessionCount,
      callCount: agentCallCount,
      recentSessions: allAgentSessions.slice(0, 20),
    },
  });
}
