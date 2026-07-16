/**
 * Trust Oracle — DojoTrustScore wiring
 *
 * Calls DojoTrustScore.updateScore() after BAS attestation.
 * Phase 1: updates evaluatorSuccess component only (passRate → bps).
 * Phase 2+: incorporate buyerAvgRating, sellerAvgBehavior, volumeScore, uptimeScore.
 *
 * Pre-requisite: relayer must hold EVALUATOR_ROLE on DojoTrustScore contract.
 * Grant:
 *   cast send <dojoTrustScore> "grantRole(bytes32,address)" \
 *     $(cast keccak "EVALUATOR_ROLE") <relayerAddress> \
 *     --private-key $ADMIN_PK --rpc-url $BSC_TESTNET_RPC
 */

import { createBscWalletClient, withRelayerLock } from './erc8004';
import { getContracts } from './contracts';

// bytes32("dojo") — left-aligned, right-padded with zeros
const DOJO_VERTICAL =
  '0x646f6a6f00000000000000000000000000000000000000000000000000000000' as const;

const DOJO_TRUST_SCORE_ABI = [
  {
    type: 'function',
    name: 'updateScore',
    inputs: [
      { name: 'subject',           type: 'address' },
      { name: 'vertical',          type: 'bytes32' },
      { name: 'evaluatorSuccess',  type: 'uint16'  },
      { name: 'buyerAvgRating',    type: 'uint16'  },
      { name: 'sellerAvgBehavior', type: 'uint16'  },
      { name: 'volumeScore',       type: 'uint16'  },
      { name: 'uptimeScore',       type: 'uint16'  },
      { name: 'sessionCount',      type: 'uint32'  },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export interface TrustUpdateParams {
  creatorAddress: string;  // address being scored (skill creator)
  passRate: number;        // 0–100 from session evaluation
  sessionCount: number;    // total settled+refunded sessions for this creator
}

/**
 * Update creator trust score after session close.
 * Fire-and-forget: caller should not await in critical path.
 *
 * Skips gracefully if:
 *   - DOJO_RELAYER_PRIVATE_KEY not set
 *   - dojoTrustScore address is zero (not yet deployed to active chain)
 */
export async function updateCreatorTrustScore(params: TrustUpdateParams): Promise<void> {
  if (!process.env.DOJO_RELAYER_PRIVATE_KEY) {
    console.warn('[trust] DOJO_RELAYER_PRIVATE_KEY not set — skipping trust update');
    return;
  }

  const contracts = getContracts();
  const contractAddress = contracts.dojoTrustScore;
  if (contractAddress === '0x0000000000000000000000000000000000000000') {
    console.warn('[trust] dojoTrustScore address not configured for active chain — skipping');
    return;
  }

  const creatorAddress = params.creatorAddress as `0x${string}`;
  if (!creatorAddress || creatorAddress === '0x0000000000000000000000000000000000000000') {
    console.warn('[trust] creator has no wallet address — skipping trust update');
    return;
  }

  // passRate 0–100 → evaluatorSuccess 0–10000 bps (uint16, max 65535)
  // Clamp to 10000 to prevent ABI overflow if passRate ever exceeds 100.
  const evaluatorSuccessBps = Math.min(Math.round(params.passRate * 100), 10000);

  await withRelayerLock(async () => {
    try {
      const walletClient = createBscWalletClient();

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: DOJO_TRUST_SCORE_ABI,
        functionName: 'updateScore',
        args: [
          creatorAddress,
          DOJO_VERTICAL,
          evaluatorSuccessBps,  // evaluatorSuccess — 35% weight
          0,                    // buyerAvgRating — Phase 2
          0,                    // sellerAvgBehavior — Phase 2
          0,                    // volumeScore — Phase 2
          0,                    // uptimeScore — Phase 2
          params.sessionCount,
        ],
      });

      console.log('[trust] updateScore tx sent:', {
        hash,
        creator: params.creatorAddress,
        passRate: params.passRate,
        evaluatorSuccessBps,
        sessionCount: params.sessionCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[trust] updateScore failed:', message);
    }
  });
}
