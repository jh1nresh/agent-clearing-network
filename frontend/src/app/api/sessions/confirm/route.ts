import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { getAcpConfig } from '@/lib/bsc-acp';
import { createBscPublicClient, getBscConfig } from '@/lib/erc8004';
import { ACP_ABI } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const SESSION_TTL_HOURS = 24;

// Job status enum from AgenticCommerceHooked.sol
const JOB_STATUS_FUNDED = 2;

/**
 * POST /api/sessions/confirm
 *
 * After the agent wallet has called createJob + setBudget + approve + fund
 * on-chain, the frontend calls this endpoint to verify on-chain state and
 * create the DB session.
 *
 * Body: { privyId, agentId, skillId, onchainJobId, budgetTotal }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, agentId, skillId, onchainJobId, budgetTotal } = body;

    if (!privyId || !agentId || !skillId || onchainJobId == null || budgetTotal == null) {
      return NextResponse.json(
        { error: 'Missing required fields: privyId, agentId, skillId, onchainJobId, budgetTotal' },
        { status: 400 }
      );
    }

    if (typeof budgetTotal !== 'number' || budgetTotal <= 0) {
      return NextResponse.json(
        { error: 'budgetTotal must be a positive number' },
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

    // Resolve skill
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (skill.skillType !== 'active' || !skill.pricePerCall || !skill.gatewaySlug) {
      return NextResponse.json(
        { error: 'Invalid active skill configuration' },
        { status: 400 }
      );
    }

    // Verify on-chain state
    const acpConfig = getAcpConfig();
    const bscConfig = getBscConfig();
    const publicClient = createBscPublicClient();

    const jobId = BigInt(onchainJobId);

    const job = await publicClient.readContract({
      address: acpConfig.acpAddress,
      abi: ACP_ABI,
      functionName: 'jobs',
      args: [jobId],
    });

    // Field order: [id, client, provider, evaluator, hook, description, budget, expiredAt, status]
    // Verified against check-onchain-job.ts (2026-04-09, job #14)
    const [jobIdOnChain, jobClient, jobProvider, jobEvaluator, , , jobBudget, , jobStatus] = job;

    // Verify job exists
    if (jobIdOnChain === 0n) {
      return NextResponse.json(
        { error: 'Job not found on-chain' },
        { status: 400 }
      );
    }

    // Verify funded
    if (Number(jobStatus) !== JOB_STATUS_FUNDED) {
      return NextResponse.json(
        { error: `Job not funded — status: ${jobStatus}` },
        { status: 400 }
      );
    }

    // Verify caller's wallet is the job client (prevents session hijacking — H-01)
    const callerWallet = (agent.walletAddress ?? user.walletAddress)?.toLowerCase();
    if (!callerWallet || (jobClient as string).toLowerCase() !== callerWallet) {
      return NextResponse.json(
        { error: 'Job client does not match agent wallet — you did not fund this job' },
        { status: 403 }
      );
    }

    // Verify provider is our relayer (so settle flow works)
    const relayerAddress = bscConfig.privateKey
      ? (await import('viem/accounts')).privateKeyToAccount(bscConfig.privateKey).address.toLowerCase()
      : null;

    if (!relayerAddress || (jobProvider as string).toLowerCase() !== relayerAddress) {
      return NextResponse.json(
        { error: 'Job provider is not the Dojo relayer — settle will fail' },
        { status: 400 }
      );
    }

    // Verify evaluator matches Dojo evaluator (M-01: close TOCTOU gap)
    if ((jobEvaluator as string).toLowerCase() !== acpConfig.evaluatorAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Job evaluator does not match Dojo evaluator' },
        { status: 400 }
      );
    }

    // Verify budget matches expected
    const expectedBudget = BigInt(Math.round(budgetTotal * 1e18));
    if (jobBudget !== expectedBudget) {
      return NextResponse.json(
        { error: `Budget mismatch: on-chain ${jobBudget.toString()} vs expected ${expectedBudget.toString()}` },
        { status: 400 }
      );
    }

    // Check for duplicate: session already exists for this onchainJobId
    const existing = await prisma.session.findFirst({
      where: { onchainJobId: onchainJobId.toString() },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Session already exists for this on-chain job', sessionId: existing.id },
        { status: 409 }
      );
    }

    // Create session with onchainJobId already set (no fire-and-forget needed)
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    const session = await prisma.session.create({
      data: {
        payerAgentId: agent.id,
        skillId: skill.id,
        budgetTotal,
        budgetRemaining: budgetTotal,
        pricePerCall: skill.pricePerCall,
        status: 'funded',
        expiresAt,
        onchainJobId: onchainJobId.toString(),
      },
    });

    console.log('[sessions/confirm] session created:', {
      sessionId: session.id,
      onchainJobId: onchainJobId.toString(),
      agentId: agent.id,
      skillId: skill.id,
      budgetTotal,
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
    console.error('[POST /api/sessions/confirm]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
