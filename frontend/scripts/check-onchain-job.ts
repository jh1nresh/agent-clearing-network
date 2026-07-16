/**
 * Query on-chain job status for jobs 10 & 11 on BSC testnet.
 * JobStatus: 0=Open, 1=Funded, 2=Submitted, 3=Completed, 4=Rejected, 5=Expired
 *
 * Uses the auto-generated `jobs(uint256)` getter (not `getJob`).
 * Solidity auto-getters for structs-with-strings return a flat tuple (no dynamic types).
 */
import { createBscPublicClient } from '@/lib/erc8004';
import { getContracts } from '@/lib/contracts';

// jobs(uint256) returns (id, client, provider, evaluator, hook, description, budget, expiredAt, status)
// But Solidity auto-getters OMIT dynamic types (string) — so returns (id, client, provider, evaluator, hook, budget, expiredAt, status)
const ACP_ABI = [
  {
    type: 'function', name: 'jobs',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'id',        type: 'uint256' },
      { name: 'client',    type: 'address' },
      { name: 'provider',  type: 'address' },
      { name: 'evaluator', type: 'address' },
      { name: 'hook',        type: 'address' },
      { name: 'description', type: 'string'  },
      { name: 'budget',      type: 'uint256' },
      { name: 'expiredAt', type: 'uint256' },
      { name: 'status',    type: 'uint8' },
    ],
    stateMutability: 'view',
  },
] as const;

const STATUS = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'];

async function main() {
  const client = createBscPublicClient();
  const acp = (process.env.BSC_ACP_ADDRESS ?? getContracts().agenticCommerceHooked) as `0x${string}`;
  console.log('acp:', acp);

  for (const jobId of [10n, 11n, 12n, 13n, 14n, 15n]) {
    try {
      const result = await client.readContract({
        address: acp,
        abi: ACP_ABI,
        functionName: 'jobs',
        args: [jobId],
      }) as readonly [bigint, string, string, string, string, string, bigint, bigint, number];

      const [id, jclient, provider, evaluator, hook, description, budget, expiredAt, status] = result;
      console.log(`\njob ${jobId}:`);
      console.log({
        id: id.toString(),
        client: jclient,
        provider,
        evaluator,
        hook,
        description,
        budget: budget.toString(),
        expiredAt: expiredAt.toString(),
        status: `${status} (${STATUS[status] ?? '?'})`,
      });
    } catch (e: any) {
      console.error(`job ${jobId} error:`, e.shortMessage ?? e.message ?? e);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
