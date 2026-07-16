/**
 * reconcile-pending-bsc-settle.ts
 *
 * CLI wrapper around `reconcilePendingBscSettle()` in src/lib/bsc-reconcile.ts.
 * Used for local dev / one-off runs. Vercel cron hits the route handler at
 * src/app/api/cron/reconcile-bsc-settle/route.ts, which calls the same function.
 *
 * Run: npx tsx scripts/reconcile-pending-bsc-settle.ts
 */

import { prisma } from '@/lib/prisma';
import { reconcilePendingBscSettle } from '@/lib/bsc-reconcile';

async function main() {
  await reconcilePendingBscSettle();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[reconcile] fatal:', err);
  process.exit(1);
});
