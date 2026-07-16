/**
 * bsc-reconcile.ts
 *
 * Shared core for BSC settle reconciliation. Called from:
 *   - scripts/reconcile-pending-bsc-settle.ts   (CLI / local dev)
 *   - src/app/api/cron/reconcile-bsc-settle/route.ts  (Vercel cron)
 *
 * Retries on-chain settle for sessions whose close handler couldn't fire
 * settleSessionOnChain inline (typically because open's fire-and-forget BSC
 * bind was still in flight when close arrived and onchainJobId was null).
 *
 * Algorithm:
 *   1. Find recently-closed sessions (status=settled, settledAt within lookback)
 *   2. For each, re-read onchainJobId (open's bind may have landed post-close)
 *   3. Read on-chain job status:
 *        Open(0)/Funded(1)/Submitted(2) → still needs settle → call settleSessionOnChain
 *        Completed(3)/Rejected(4)/Expired(5) → already terminal on-chain → skip
 *   4. Skip FAIL (refunded) sessions — Phase 1 has no refund-release path
 *      until Phase 2 MicroEvaluator.
 *
 * Idempotent: re-runs are safe. settleSessionOnChain is guarded by on-chain
 * status; if the tx already landed, the next read returns Completed/Rejected
 * and this function skips.
 *
 * Related: src/app/api/sessions/[id]/close/route.ts (the handler that defers
 * settle when onchainJobId is still null at close time).
 */

import { prisma } from '@/lib/prisma';
import { createBscPublicClient } from '@/lib/erc8004';
import { getContracts } from '@/lib/contracts';
import { settleSessionOnChain } from '@/lib/bsc-acp';

export const MAX_PER_RUN = 25;
// Cron fires every 5 minutes (vercel.json). 60-minute window gives 12 retry attempts
// per deferred session before it falls out of scope. Extend if BSC bind can take >55min.
export const LOOKBACK_MINUTES = 60;

// Matches scripts/check-onchain-job.ts — Solidity auto-getter output shape.
// IMPORTANT: must include `description` (string) or viem mis-decodes as
// "BigInt not in safe integer range". See brain/wiki/projects/dojo/patterns.md #9.
const ACP_ABI = [
  {
    type: 'function', name: 'jobs',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'id',          type: 'uint256' },
      { name: 'client',      type: 'address' },
      { name: 'provider',    type: 'address' },
      { name: 'evaluator',   type: 'address' },
      { name: 'hook',        type: 'address' },
      { name: 'description', type: 'string' },
      { name: 'budget',      type: 'uint256' },
      { name: 'expiredAt',   type: 'uint256' },
      { name: 'status',      type: 'uint8' },
    ],
    stateMutability: 'view',
  },
] as const;

const STATUS = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'] as const;
const NEEDS_SETTLE = new Set([0, 1, 2]); // Open, Funded, Submitted

export interface ReconcileStats {
  checked: number;
  skippedNoJobId: number;
  skippedTerminal: number;
  settled: number;
  failed: number;
  aborted?: string;
}

async function readJobStatus(acp: `0x${string}`, jobId: bigint): Promise<number | null> {
  try {
    const client = createBscPublicClient();
    const result = await client.readContract({
      address: acp,
      abi: ACP_ABI,
      functionName: 'jobs',
      args: [jobId],
    }) as readonly [bigint, string, string, string, string, string, bigint, bigint, number];
    // index 8 = status (id, client, provider, evaluator, hook, description, budget, expiredAt, status)
    const STATUS_IDX = 8;
    return result[STATUS_IDX];
  } catch (e) {
    console.warn(`[reconcile] jobs(${jobId}) read failed:`, (e as Error).message);
    return null;
  }
}

/**
 * Run one reconciliation pass. Returns stats for logging / cron monitoring.
 * Never throws — transient errors are logged and reflected in `failed`.
 */
export async function reconcilePendingBscSettle(): Promise<ReconcileStats> {
  console.log('[reconcile] starting pending BSC settle reconciliation...');

  const acpAddress = (process.env.BSC_ACP_ADDRESS ?? getContracts().agenticCommerceHooked) as `0x${string}`;
  if (!acpAddress || acpAddress === '0x0000000000000000000000000000000000000000') {
    console.error('[reconcile] BSC_ACP_ADDRESS not configured — aborting');
    return { checked: 0, skippedNoJobId: 0, skippedTerminal: 0, settled: 0, failed: 0, aborted: 'acp-address-not-configured' };
  }

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  // Exclude sessions settled in the last 60s: gives the close route's fire-and-forget
  // settleSessionOnChain call time to mine before we re-read on-chain status.
  // Without this, the cron can race with the inline settle tx and double-fire.
  const graceCutoff = new Date(Date.now() - 60 * 1000);

  // PASS sessions (settled) only — FAIL (refunded) has no release path in Phase 1.
  const candidates = await prisma.session.findMany({
    where: {
      status: 'settled',
      settledAt: { gte: since, lte: graceCutoff },
    },
    select: {
      id: true,
      onchainJobId: true,
      callCount: true,
      settledAt: true,
    },
    orderBy: { settledAt: 'asc' },
    take: MAX_PER_RUN,
  });

  console.log(`[reconcile] found ${candidates.length} recently-settled session(s) to check`);

  const stats: ReconcileStats = {
    checked: 0,
    skippedNoJobId: 0,
    skippedTerminal: 0,
    settled: 0,
    failed: 0,
  };

  for (const session of candidates) {
    stats.checked++;

    if (!session.onchainJobId) {
      const ageMs = session.settledAt ? Date.now() - session.settledAt.getTime() : 0;
      const ageMin = Math.round(ageMs / 60_000);
      if (ageMin >= LOOKBACK_MINUTES - 5) {
        // Near the lookback ceiling with no jobId — this session is about to fall out
        // of the reconcile window permanently. Manual intervention may be needed.
        console.error(`[reconcile] ALERT: ${session.id} — onchainJobId null for ${ageMin}min, nearing LOOKBACK_MINUTES ceiling. Open bind may have failed permanently.`);
      } else {
        console.log(`[reconcile] ${session.id} — onchainJobId still null (${ageMin}min old), open bind has not landed yet, skipping`);
      }
      stats.skippedNoJobId++;
      continue;
    }

    // Validate onchainJobId before BigInt cast — a malformed value throws SyntaxError
    // which would abort the entire loop, leaving all subsequent sessions unprocessed.
    if (!/^[0-9]+$/.test(session.onchainJobId)) {
      console.error(`[reconcile] ${session.id} — invalid onchainJobId format: "${session.onchainJobId}", skipping`);
      stats.failed++;
      continue;
    }

    try {
      const jobId = BigInt(session.onchainJobId);
      const onChainStatus = await readJobStatus(acpAddress, jobId);
      if (onChainStatus === null) {
        // BSC RPC failure — count as failed so monitoring dashboards see the gap.
        stats.failed++;
        continue;
      }

      if (!NEEDS_SETTLE.has(onChainStatus)) {
        // Already Completed / Rejected / Expired — nothing to do.
        stats.skippedTerminal++;
        continue;
      }

      console.log(`[reconcile] ${session.id} — job ${jobId} is ${STATUS[onChainStatus]}, firing settle...`);
      const result = await settleSessionOnChain({
        jobId: session.onchainJobId,
        sessionId: session.id,
        callCount: session.callCount,
      });

      if (result.success) {
        stats.settled++;
        console.log(`[reconcile] ${session.id} — settle ok: tx=${result.txHash}`);
      } else {
        stats.failed++;
        console.error(`[reconcile] ${session.id} — settle failed: ${result.error}`);
      }
    } catch (err) {
      // Unexpected error in per-session handling — log and continue to next session.
      stats.failed++;
      console.error(`[reconcile] ${session.id} — unexpected error:`, err);
    }
  }

  if (stats.skippedNoJobId > 0) {
    console.warn(`[reconcile] ${stats.skippedNoJobId} session(s) still have no onchainJobId. If this persists beyond ${LOOKBACK_MINUTES} minutes they will be permanently unreconciled and may need manual intervention.`);
  }

  console.log('[reconcile] done:', stats);
  return stats;
}
