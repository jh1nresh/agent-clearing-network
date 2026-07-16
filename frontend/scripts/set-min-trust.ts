/**
 * Phase 1 sanity-check model: set TrustBasedEvaluator.minTrustScore = 0
 * so every submitted job auto-completes (skips provider trust gating).
 *
 * Relayer owns the evaluator (verified via check-evaluator.ts).
 */
import { createBscPublicClient, createBscWalletClient } from '@/lib/erc8004';
import { getContracts } from '@/lib/contracts';

const EVAL_ABI = [
  { type: 'function', name: 'setMinTrustScore', inputs: [{ name: 'score', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'minTrustScore',    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

async function main() {
  const client = createBscPublicClient();
  const wallet = createBscWalletClient();
  const evaluator = (process.env.BSC_EVALUATOR_ADDRESS ?? getContracts().trustBasedEvaluator) as `0x${string}`;

  const before = await client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'minTrustScore' });
  console.log('before:', before.toString());

  if (before === 0n) {
    console.log('already 0 — skipping tx');
    return;
  }

  const hash = await wallet.writeContract({
    address: evaluator, abi: EVAL_ABI, functionName: 'setMinTrustScore', args: [0n],
  });
  console.log('tx:', hash);
  const rcpt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 20_000 });
  console.log('status:', rcpt.status);

  const after = await client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'minTrustScore' });
  console.log('after:', after.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
