import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { createSessionOnChain } from '@/lib/bsc-acp';

export const dynamic = 'force-dynamic';

const SESSION_TTL_HOURS = 24;

/**
 * POST /api/sessions/open
 *
 * Agent opens a metered session against an active skill by pre-funding an
 * escrow budget. Creates a Session row, fires-and-forgets an ERC-8183 job
 * binding on-chain, and returns the session handle the agent uses to call
 * the gateway at `/skills/{slug}/run`.
 *
 * See: specs/2026-04-05-session-as-job-migration.md
 *
 * Body: {
 *   privyId: string;      // JWT subject (must match Authorization header)
 *   agentId: string;      // agent that will be the 8183 payer
 *   skillId: string;      // active skill to meter against
 *   budgetTotal: number;  // USDC amount to escrow
 * }
 *
 * Returns: {
 *   session: {
 *     id, status, budgetTotal, budgetRemaining, pricePerCall,
 *     callCount, openedAt, expiresAt, skillId, payerAgentId,
 *     gatewaySlug, onchainJobId
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, agentId, skillId, budgetTotal } = body;

    if (!privyId || !agentId || !skillId || budgetTotal == null) {
      return NextResponse.json(
        { error: 'Missing required fields: privyId, agentId, skillId, budgetTotal' },
        { status: 400 }
      );
    }

    if (typeof budgetTotal !== 'number' || budgetTotal <= 0) {
      return NextResponse.json(
        { error: 'budgetTotal must be a positive number (USDC)' },
        { status: 400 }
      );
    }

    // Verify JWT; privyId in body must match token subject
    // Dev bypass: DOJO_SKIP_PRIVY_AUTH=true skips JWT check (non-production only)
    const skipAuth =
      process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (!skipAuth) {
      const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
      if (!authResult.success || authResult.privyId !== privyId) {
        return NextResponse.json(
          { error: 'Unauthorized — privyId mismatch' },
          { status: 403 }
        );
      }
    }

    // Resolve user
    const user = await prisma.user.findUnique({ where: { privyId } });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found — sync account first' },
        { status: 404 }
      );
    }

    // Verify agent ownership. Phase 1: relayer is the on-chain payer, agent wallet
    // is not required yet. Phase 2: restore walletAddress check when agents pay directly.
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, ownerId: user.id },
    });
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found or not owned by user' },
        { status: 404 }
      );
    }

    // Resolve skill + validate active-skill shape
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      include: { creator: true },
    });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (skill.skillType !== 'active') {
      return NextResponse.json(
        { error: 'Skill is not an active skill — use /api/skills/[id]/buy for passive skills' },
        { status: 400 }
      );
    }
    if (!skill.pricePerCall || skill.pricePerCall <= 0) {
      return NextResponse.json(
        { error: 'Active skill is missing pricePerCall configuration' },
        { status: 400 }
      );
    }
    if (!skill.gatewaySlug) {
      return NextResponse.json(
        { error: 'Active skill is missing gatewaySlug — creator has not published to gateway' },
        { status: 400 }
      );
    }

    // Snapshot pricePerCall at open time — session uses this for the full lifetime
    const pricePerCall = skill.pricePerCall;

    // Minimum budget = 1 call worth
    if (budgetTotal < pricePerCall) {
      return NextResponse.json(
        {
          error: `budgetTotal too small: ${budgetTotal} USDC < pricePerCall ${pricePerCall} USDC`,
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    // Create Session row in DB first (source of truth). onchainJobId populated
    // fire-and-forget below once the 8183 binding tx confirms.
    const session = await prisma.session.create({
      data: {
        payerAgentId: agent.id,
        skillId: skill.id,
        budgetTotal,
        budgetRemaining: budgetTotal,
        pricePerCall,
        status: 'funded',
        expiresAt,
      },
    });

    console.log('[sessions/open] session created:', {
      sessionId: session.id,
      agentId: agent.id,
      skillId: skill.id,
      budgetTotal,
      pricePerCall,
      expiresAt: expiresAt.toISOString(),
    });

    // Fire-and-forget: create + fund job on BSC AgenticCommerceHooked.
    // Phase 1: relayer is both client and provider — no creator wallet needed.
    const expiredAt = BigInt(Math.floor(expiresAt.getTime() / 1000));
    // USDC has 18 decimals on BSC; budgetTotal is plain USDC (1.0 = 1 USDC)
    const budgetUsdc = BigInt(Math.round(budgetTotal * 1e18));
    createSessionOnChain({
      description: skill.name,
      expiredAt,
      budgetUsdc,
    })
      .then(async (result) => {
        if (result.success && result.jobId) {
          await prisma.session.update({
            where: { id: session.id },
            data: { onchainJobId: result.jobId },
          });
          console.log('[sessions/open] BSC job bound:', {
            sessionId: session.id,
            onchainJobId: result.jobId,
            txHash: result.txHash,
          });
        } else {
          console.warn('[sessions/open] BSC binding failed:', {
            sessionId: session.id,
            error: result.error,
          });
        }
      })
      .catch((err) => {
        console.error('[sessions/open] BSC binding exception:', err);
      });

    return NextResponse.json(
      {
        session: {
          id: session.id,
          status: session.status,
          budgetTotal: session.budgetTotal,
          budgetRemaining: session.budgetRemaining,
          pricePerCall: session.pricePerCall,
          callCount: session.callCount,
          openedAt: session.openedAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          skillId: session.skillId,
          payerAgentId: session.payerAgentId,
          gatewaySlug: skill.gatewaySlug,
          onchainJobId: session.onchainJobId,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('[POST /api/sessions/open]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
