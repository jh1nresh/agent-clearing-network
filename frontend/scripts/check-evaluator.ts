/**
 * Check TrustBasedEvaluator minTrustScore and owner + provider trust score.
 */
import { createBscPublicClient, createBscWalletClient } from '@/lib/erc8004';
import { getContracts } from '@/lib/contracts';

const EVAL_ABI = [
  { type: 'function', name: 'minTrustScore', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'owner',         inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'oracle',        inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalEvaluated',inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalApproved', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalRejected', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

const ORACLE_ABI = [
  { type: 'function', name: 'getTrustScore', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

async function main() {
  const client = createBscPublicClient();
  const wallet = createBscWalletClient();
  const relayer = wallet.account.address;

  const c = getContracts();
  const evaluator = (process.env.BSC_EVALUATOR_ADDRESS ?? c.trustBasedEvaluator) as `0x${string}`;

  const [minScore, owner, oracle, totalEval, totalApp, totalRej] = await Promise.all([
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'minTrustScore' }),
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'owner' }),
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'oracle' }),
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'totalEvaluated' }),
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'totalApproved' }),
    client.readContract({ address: evaluator, abi: EVAL_ABI, functionName: 'totalRejected' }),
  ]);

  console.log('evaluator:', evaluator);
  console.log('  minTrustScore:', minScore.toString());
  console.log('  owner:        ', owner);
  console.log('  oracle:       ', oracle);
  console.log('  totalEvaluated:', totalEval.toString());
  console.log('  totalApproved:', totalApp.toString());
  console.log('  totalRejected:', totalRej.toString());

  const providerScore = await client.readContract({
    address: oracle as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: 'getTrustScore',
    args: [relayer],
  });
  console.log('\nrelayer:', relayer);
  console.log('  ownerIsRelayer:', String(owner).toLowerCase() === relayer.toLowerCase());
  console.log('  trustScore:', providerScore.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
