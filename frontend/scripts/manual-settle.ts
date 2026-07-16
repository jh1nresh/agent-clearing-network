/**
 * Manually invoke settleSessionOnChain for job 10 (Session A, PASS).
 * Diagnoses whether the fire-and-forget in close/route.ts is failing silently
 * or whether there's a deeper issue with submit/evaluate on BSC.
 */
import { settleSessionOnChain } from '@/lib/bsc-acp';

async function main() {
  console.log('[manual-settle] starting settle for job 10...');
  const result = await settleSessionOnChain({
    jobId: '10',
    sessionId: 'cmns2k95c000h9nx1a9rafbbk',
    callCount: 5,
  });
  console.log('[manual-settle] result:', result);
}

main().catch((e) => { console.error('[manual-settle] fatal:', e); process.exit(1); });
