import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toBytes } from 'viem';
import { evaluateCall } from '@/lib/session-evaluator';
import { settleSession } from '@/lib/settle-session';
import { anchorExecutionAsync, PHASE2_ADDRESSES } from '@/lib/swap-router';
import { prisma } from '@/lib/prisma';
import { parseBody, v1RunInput } from '@/lib/validators';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/run
 *
 * Dead-simple REST wrapper for agent developers.
 * One HTTP call = find skill → find/create session → call skill → evaluate → return.
 *
 * Auth: Bearer API key (not Privy JWT).
 * Agent developers never see sessions, nonces, or escrow.
 *
 * Request:
 *   { "skill": "web-scraper", "input": { "url": "https://example.com" } }
 *
 * Response:
 *   { "result": { ... }, "cost": 0.003, "balance": 9.997, "score": 1.0, "session_id": "..." }
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
  const parsed = await parseBody(req, v1RunInput);
  if (!parsed.success) return parsed.response;
  const { skill: skillSlug, input } = parsed.data;

  // --- Find skill ---
  const skill = await prisma.skill.findUnique({
    where: { gatewaySlug: skillSlug },
  });

  if (!skill) {
    return NextResponse.json(
      { error: `Skill "${skillSlug}" not found` },
      { status: 404 },
    );
  }

  if (skill.skillType !== 'active' || !skill.endpointUrl) {
    return NextResponse.json(
      { error: `Skill "${skillSlug}" is not an active (pay-per-use) skill` },
      { status: 400 },
    );
  }

  const pricePerCall = skill.pricePerCall ?? 0;

  // --- Balance check ---
  if (user.creditBalance < pricePerCall) {
    return NextResponse.json(
      {
        error: 'Insufficient credits',
        balance: user.creditBalance,
        required: pricePerCall,
      },
      { status: 402 },
    );
  }

  // --- Find or create session for this user+skill ---
  // Reuse an open session if available; otherwise create one.
  const agent = await prisma.agent.findFirst({
    where: { ownerId: user.id },
  });

  if (!agent) {
    return NextResponse.json(
      { error: 'No agent found. Create an agent first.' },
      { status: 400 },
    );
  }

  let session = await prisma.session.findFirst({
    where: {
      payerAgentId: agent.id,
      skillId: skill.id,
      status: { in: ['funded', 'active'] },
      expiresAt: { gt: new Date() },
      budgetRemaining: { gte: pricePerCall },
    },
    orderBy: { openedAt: 'desc' },
  });

  if (!session) {
    // Auto-create a session with budget = user's full credit balance
    const budget = Math.min(user.creditBalance, 100); // cap at $100 per session
    session = await prisma.session.create({
      data: {
        payerAgentId: agent.id,
        skillId: skill.id,
        budgetTotal: budget,
        budgetRemaining: budget,
        pricePerCall,
        status: 'funded',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        // TODO(F6): Phase 2 — bind session to BSC on-chain job via AgenticCommerceHooked.
        // onchainJobId is intentionally null here; REST API sessions are off-chain only.
        // On-chain binding requires: agent wallet + createJob + setBudget + fund (see bsc-acp.ts).
      },
    });
  }

  // --- Compute nonce (max existing + 1) ---
  const lastCall = await prisma.skillCall.findFirst({
    where: { sessionId: session.id },
    orderBy: { nonce: 'desc' },
    select: { nonce: true },
  });
  const nonce = (lastCall?.nonce ?? 0) + 1;

  // --- Forward to skill endpoint ---
  const rawBody = JSON.stringify(input ?? {});
  const start = Date.now();
  let creatorStatus = 0;
  let creatorBody = '';
  let failed = false;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Dojo-SkillSlug': skillSlug,
    };
    if (skill.creatorHmacSecret) {
      // HMAC auth for creator endpoint
      const { createHmac } = await import('crypto');
      headers['X-Dojo-HMAC'] = createHmac('sha256', skill.creatorHmacSecret)
        .update(rawBody)
        .digest('hex');
    }

    const res = await fetch(skill.endpointUrl, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(30_000),
    });

    creatorStatus = res.status;

    // Cap response body at 1 MB to prevent OOM (F4)
    const MAX_BODY_BYTES = 1_048_576;
    const contentLength = Number(res.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      creatorBody = '';
      failed = true;
    } else {
      creatorBody = await res.text();
      if (Buffer.byteLength(creatorBody, 'utf8') > MAX_BODY_BYTES) {
        creatorBody = '';
        failed = true;
      }
    }
  } catch {
    failed = true;
  }

  const latencyMs = Date.now() - start;

  // --- Evaluate ---
  const requestHash = `nonce:${nonce}:${session.id}`;
  const evalResult = evaluateCall(creatorStatus, creatorBody, latencyMs, failed);

  // --- Write SkillCall + decrement budget atomically ---
  const shouldCharge = !failed && creatorStatus > 0;
  const cost = shouldCharge ? pricePerCall : 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.skillCall.create({
        data: {
          sessionId: session!.id,
          nonce,
          requestHash,
          status: failed ? 'gateway_error' : creatorStatus < 400 ? 'success' : 'creator_error',
          httpStatus: creatorStatus,
          latencyMs,
          costUsdc: cost,
          responseHash: evalResult.responseHash,
          delivered: evalResult.delivered,
          validFormat: evalResult.validFormat,
          withinSla: evalResult.withinSla,
          score: evalResult.score,
        },
      });

      if (shouldCharge) {
        // Decrement session budget
        const updated = await tx.session.updateMany({
          where: {
            id: session!.id,
            status: { in: ['funded', 'active'] },
            budgetRemaining: { gte: pricePerCall },
          },
          data: {
            budgetRemaining: { decrement: pricePerCall },
            callCount: { increment: 1 },
            status: 'active',
          },
        });

        if (updated.count === 0) {
          throw new Error('SESSION_CLOSED_OR_EXHAUSTED');
        }

        // Decrement user credit balance — guard prevents negative balance under concurrency (F3)
        const userUpdated = await tx.user.updateMany({
          where: { id: user.id, creditBalance: { gte: pricePerCall } },
          data: { creditBalance: { decrement: pricePerCall } },
        });

        if (userUpdated.count === 0) {
          throw new Error('INSUFFICIENT_BALANCE');
        }
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Transaction failed';
    if (msg === 'SESSION_CLOSED_OR_EXHAUSTED') {
      return NextResponse.json(
        { error: 'Session exhausted during call. Retry.' },
        { status: 409 },
      );
    }
    if (msg === 'INSUFFICIENT_BALANCE') {
      return NextResponse.json(
        { error: 'Insufficient credits — concurrent call drained balance.' },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // --- Auto-close: settle session when budget exhausted ---
  // Re-read after transaction to get the actual post-decrement value.
  // session.budgetRemaining is a pre-transaction snapshot that doesn't reflect
  // concurrent decrements — using it would miss auto-settle under concurrency.
  let settleTriggered = false;
  if (shouldCharge) {
    const latest = await prisma.session.findUnique({
      where: { id: session.id },
      select: { budgetRemaining: true },
    });
    if (latest && latest.budgetRemaining < pricePerCall) {
      settleTriggered = true;
      // Fire-and-forget: settle session in background (idempotent)
      void settleSession(session.id).catch((err) => {
        logError('v1/run:settle', err, { sessionId: session.id });
      });
    }
  }

  // --- Parse creator response ---
  let result: unknown = creatorBody;
  try {
    result = JSON.parse(creatorBody);
  } catch {
    // keep as string
  }

  // --- Response ---
  if (failed) {
    return NextResponse.json(
      {
        error: 'Skill endpoint unreachable or timed out',
        cost: 0,
        balance: user.creditBalance,
        session_id: session.id,
      },
      { status: 502 },
    );
  }

  // --- Phase 2 on-chain anchor (fire-and-forget) ---
  // Anchor successful executions to BSC via SwapRouter. Non-blocking — if the
  // RPC is down or the skill isn't registered on-chain, API response is
  // unaffected. The tx hashes land in logs for demo/verification.
  // Resolves the on-chain skillId by hashing the gatewaySlug (must match the
  // slug used at `SkillRegistry.register` time).
  let onchainPromise: Promise<void> | null = null;
  if (shouldCharge && skill.gatewaySlug) {
    const onchainSkillId = keccak256(toBytes(skill.gatewaySlug));
    onchainPromise = anchorExecutionAsync(
      onchainSkillId,
      !failed,
      evalResult.responseHash,
    )
      .then((r) => {
        if (r.ok) {
          console.log('[v1/run] anchored', {
            skill: skillSlug,
            swap: r.swapTxHash,
            settle: r.settleTxHash,
          });
        }
      })
      .catch((err) => logError('v1/run:anchor', err, { skill: skillSlug }));
  }

  return NextResponse.json({
    result,
    cost,
    balance: user.creditBalance - cost,
    score: evalResult.score,
    session_id: session.id,
    latency_ms: latencyMs,
    ...(settleTriggered && { settle_triggered: true }),
    ...(onchainPromise && {
      onchain: {
        chain: 'bsc-testnet',
        router: PHASE2_ADDRESSES.swapRouter,
        anchored: 'pending', // fire-and-forget; check logs for tx hashes
      },
    }),
  });
}
