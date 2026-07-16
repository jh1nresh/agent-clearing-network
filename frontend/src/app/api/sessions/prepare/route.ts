import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { getAcpConfig } from '@/lib/bsc-acp';
import { getBscConfig } from '@/lib/erc8004';

export const dynamic = 'force-dynamic';

const SESSION_TTL_HOURS = 24;

/**
 * POST /api/sessions/prepare
 *
 * Returns protocol params so the agent's wallet can construct + sign
 * the on-chain txs (createJob, setBudget, approve, fund) client-side.
 * No on-chain interaction, no DB write. Pure validation + config return.
 *
 * Body: { privyId, agentId, skillId, budgetTotal }
 * Response: { chainId, acpAddress, usdcAddress, evaluatorAddress,
 *             hookAddress, provider, budgetUsdc, expiredAt, description }
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

    // Auth
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

    // Verify agent ownership
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
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (skill.skillType !== 'active') {
      return NextResponse.json(
        { error: 'Skill is not an active skill' },
        { status: 400 }
      );
    }
    if (!skill.pricePerCall || skill.pricePerCall <= 0) {
      return NextResponse.json(
        { error: 'Active skill is missing pricePerCall' },
        { status: 400 }
      );
    }
    if (!skill.gatewaySlug) {
      return NextResponse.json(
        { error: 'Active skill is missing gatewaySlug' },
        { status: 400 }
      );
    }

    if (budgetTotal < skill.pricePerCall) {
      return NextResponse.json(
        { error: `budgetTotal too small: ${budgetTotal} < pricePerCall ${skill.pricePerCall}` },
        { status: 400 }
      );
    }

    // Build protocol params
    const acpConfig = getAcpConfig();
    const bscConfig = getBscConfig();
    const expiredAt = Math.floor((Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000) / 1000);
    // USDC has 18 decimals on BSC
    const budgetUsdc = BigInt(Math.round(budgetTotal * 1e18)).toString();

    // Relayer address = provider for the job
    const relayerAddress = bscConfig.privateKey
      ? (await import('viem/accounts')).privateKeyToAccount(bscConfig.privateKey).address
      : null;

    if (!relayerAddress) {
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      chainId: bscConfig.chain.id,
      acpAddress: acpConfig.acpAddress,
      usdcAddress: acpConfig.usdcAddress,
      evaluatorAddress: acpConfig.evaluatorAddress,
      hookAddress: '0x0000000000000000000000000000000000000000',
      provider: relayerAddress,
      budgetUsdc,
      expiredAt,
      description: skill.name,
      // Pass back for confirm step
      pricePerCall: skill.pricePerCall,
      gatewaySlug: skill.gatewaySlug,
    });
  } catch (err: unknown) {
    console.error('[POST /api/sessions/prepare]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
