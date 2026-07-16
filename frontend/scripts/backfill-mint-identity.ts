/**
 * backfill-mint-identity.ts
 *
 * One-time script: mark all existing users without an ERC-8004 identity
 * as pendingMint=true so the retry-pending-mints cron picks them up.
 *
 * Run via: npx tsx scripts/backfill-mint-identity.ts
 *
 * Spec B §6 + §8 acceptance criteria:
 *   "Backfill script marks all existing users (where erc8004TokenId IS NULL)
 *    as pendingMint=true"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[backfill-mint-identity] starting...');

  // Count eligible users first
  const total = await prisma.user.count({
    where: {
      erc8004TokenId: null,
      pendingMint: false,
      walletAddress: { not: null },
    },
  });

  console.log(`[backfill-mint-identity] found ${total} users to backfill`);

  if (total === 0) {
    console.log('[backfill-mint-identity] nothing to do');
    return;
  }

  // Mark all eligible users as pendingMint=true in one shot
  const result = await prisma.user.updateMany({
    where: {
      erc8004TokenId: null,
      pendingMint: false,
      walletAddress: { not: null },
    },
    data: { pendingMint: true },
  });

  console.log(`[backfill-mint-identity] marked ${result.count} users as pendingMint=true`);
  console.log('[backfill-mint-identity] run retry-pending-mints.ts to process them');
}

main()
  .catch((err) => {
    console.error('[backfill-mint-identity] fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
