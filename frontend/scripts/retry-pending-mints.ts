/**
 * retry-pending-mints.ts
 *
 * Cron script: retry ERC-8004 mints for users where pendingMint=true.
 * Run via: npx tsx scripts/retry-pending-mints.ts
 * Schedule: Vercel cron every 10 min (cron: "every 10 minutes")
 *
 * First checks on-chain (maybe tx landed), then re-submits if still missing.
 */

import { PrismaClient } from '@prisma/client';
import { mintIdentityFor, getAgentIdOf } from '../src/lib/erc8004';
import { checkRelayerBalance } from '../src/lib/relayer';

const prisma = new PrismaClient();
const MAX_PER_RUN = 20;

async function main() {
  console.log('[retry-pending-mints] starting...');

  const balance = await checkRelayerBalance();
  if (!balance.ok) {
    console.error('[retry-pending-mints] Relayer balance too low:', balance.balanceBnb, 'BNB — aborting');
    return;
  }

  const pending = await prisma.user.findMany({
    where: { pendingMint: true, walletAddress: { not: null } },
    take: MAX_PER_RUN,
  });

  console.log(`[retry-pending-mints] found ${pending.length} pending user(s)`);

  for (const user of pending) {
    if (!user.walletAddress) continue;
    const wallet = user.walletAddress as `0x${string}`;

    // First: check if tx already landed on-chain
    let onChainId: bigint;
    try {
      onChainId = await getAgentIdOf(wallet);
    } catch (rpcErr) {
      console.warn(`[retry-pending-mints] ${wallet} — RPC error checking on-chain, skipping:`, rpcErr);
      continue;
    }
    if (onChainId > 0n) {
      await prisma.user.update({
        where: { id: user.id },
        data: { erc8004TokenId: onChainId, kyaLevel: 0, pendingMint: false },
      });
      console.log(`[retry-pending-mints] ${wallet} — found on-chain: agentId=${onChainId}`);
      continue;
    }

    // Then: re-submit
    const result = await mintIdentityFor(wallet);
    if (result.success && result.agentId != null && result.agentId > 0n) {
      await prisma.user.update({
        where: { id: user.id },
        data: { erc8004TokenId: result.agentId, kyaLevel: 0, pendingMint: false },
      });
      console.log(`[retry-pending-mints] ${wallet} — minted: agentId=${result.agentId} tx=${result.txHash}`);
    } else {
      console.error(`[retry-pending-mints] ${wallet} — retry failed: ${result.error}`);
      // leave pendingMint=true for next run
    }
  }

  console.log('[retry-pending-mints] done');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[retry-pending-mints] fatal:', err);
  process.exit(1);
});
