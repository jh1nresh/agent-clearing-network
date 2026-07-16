/**
 * Dojo Relayer Wallet — BSC
 *
 * The relayer is a server-side wallet that submits ERC-8004 registration txs
 * on behalf of users. Users pay no gas.
 *
 * Balance guard: if balance < MIN_BNB_BALANCE, refuse new mints and alert.
 */

import { createBscPublicClient } from './erc8004';
import { privateKeyToAccount } from 'viem/accounts';

// Refuse mints if relayer balance drops below this threshold.
// 0.001 BNB ≈ $0.60 at current prices — covers ~6000 BSC mints (gas ~$0.0001/tx).
// Spec B originally said 0.002 ETH (Base); on BSC 0.001 BNB provides equivalent safety margin.
const MIN_BNB_BALANCE = 1_000_000_000_000_000n; // 0.001 BNB in wei

export interface RelayerBalanceResult {
  ok: boolean;
  balanceWei: bigint;
  balanceBnb: string;
  error?: string;
}

/**
 * Get relayer wallet address from env.
 */
export function getRelayerAddress(): `0x${string}` | null {
  const key = process.env.DOJO_RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return null;
  try {
    return privateKeyToAccount(key).address;
  } catch (err) {
    console.error('[relayer] Invalid DOJO_RELAYER_PRIVATE_KEY format:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Check relayer BNB balance.
 * Returns ok=false if balance < MIN_BNB_BALANCE or key not set.
 */
export async function checkRelayerBalance(): Promise<RelayerBalanceResult> {
  const address = getRelayerAddress();

  if (!address) {
    return {
      ok: false,
      balanceWei: 0n,
      balanceBnb: '0',
      error: 'DOJO_RELAYER_PRIVATE_KEY not configured',
    };
  }

  try {
    const publicClient = createBscPublicClient();
    const balanceWei = await publicClient.getBalance({ address });
    const balanceBnb = (Number(balanceWei) / 1e18).toFixed(6);
    const ok = balanceWei >= MIN_BNB_BALANCE;

    if (!ok) {
      console.warn(
        `[relayer] Low balance alert: ${balanceBnb} BNB (min ${Number(MIN_BNB_BALANCE) / 1e18} BNB)`
      );
    }

    return { ok, balanceWei, balanceBnb };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[relayer] Balance check failed:', message);
    return { ok: false, balanceWei: 0n, balanceBnb: '0', error: message };
  }
}
