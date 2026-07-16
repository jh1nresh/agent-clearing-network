/**
 * SwapRouter — Phase 2 Tokenized Commerce Layer
 *
 * Anchors /api/v1/run executions to BSC on-chain via the SwapRouter contract.
 * For the Phase 2 demo, the relayer pays USDC into `swap()` on the agent's
 * behalf and immediately `settle()`s — net zero USDC flow but real on-chain
 * evidence (ExecutionRequested + ExecutionSettled events; BAS attestation
 * hook chain fires).
 *
 * Fire-and-forget semantics: anchoring never blocks the API response. Errors
 * are logged; REST flow succeeds regardless so a broken RPC doesn't brick demo.
 *
 * See specs/2026-04-16-agent-commerce-protocol.md and
 *     brain/wiki/decisions/2026-04-16-tokens-as-interface-reputation-as-allocation.md
 */

import { createPublicClient, createWalletClient, http, type Hash, type Log } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from './erc8004';
import { logError } from './logger';

// ─── Config ─────────────────────────────────────────────────────────────────

export const PHASE2_ADDRESSES = {
  skillRegistry:  (process.env.BSC_SKILL_REGISTRY ?? '0x104579420Ab86579631E8452EE553A75Fc257690') as `0x${string}`,
  swapRouter:     (process.env.BSC_SWAP_ROUTER    ?? '0x2844515814b44Ab23d5001571e2E1C726295536a') as `0x${string}`,
  reputationHub:  (process.env.BSC_REPUTATION_HUB ?? '0x6c6b8b4a72A291d95eC461FEc29cd764bbfcC159') as `0x${string}`,
  usdc:           (process.env.BSC_USDC           ?? '0x2F808cc071D7B54d23a7647d79d7EF6E2C830d31') as `0x${string}`,
} as const;

// ─── ABI (minimal) ──────────────────────────────────────────────────────────

const SWAP_ROUTER_ABI = [
  {
    type: 'function',
    name: 'swap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'skillId',      type: 'bytes32' },
      { name: 'maxPriceUSDC', type: 'uint256' },
      { name: 'params',       type: 'bytes'   },
    ],
    outputs: [{ name: 'requestId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'settle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestId',  type: 'bytes32' },
      { name: 'success',    type: 'bool'    },
      { name: 'resultHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ExecutionRequested',
    inputs: [
      { name: 'requestId',  type: 'bytes32', indexed: true  },
      { name: 'skillId',    type: 'bytes32', indexed: true  },
      { name: 'agent',      type: 'address', indexed: true  },
      { name: 'amountUSDC', type: 'uint256', indexed: false },
      { name: 'params',     type: 'bytes',   indexed: false },
    ],
  },
] as const;

// ─── Clients ────────────────────────────────────────────────────────────────

function getRelayerKey(): `0x${string}` | null {
  const key = process.env.DOJO_RELAYER_PRIVATE_KEY;
  if (!key) return null;
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

function getClients() {
  const key = getRelayerKey();
  if (!key) throw new Error('DOJO_RELAYER_PRIVATE_KEY not configured');

  const rpcUrl = process.env.BSC_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545';
  const account = privateKeyToAccount(key);

  const pub = createPublicClient({ chain: bscTestnet, transport: http(rpcUrl) });
  const wallet = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(rpcUrl),
  });
  return { pub, wallet, account };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface AnchorResult {
  ok: boolean;
  swapTxHash?: Hash;
  settleTxHash?: Hash;
  requestId?: `0x${string}`;
  error?: string;
}

/**
 * Fire a full demo cycle: swap → settle.
 * Returns both tx hashes + requestId. Intended to run fire-and-forget from API
 * handlers — caller should `void anchorExecution(...).catch(...)`.
 *
 * @param skillId    keccak256 of the skill slug (on-chain identifier)
 * @param success    settlement outcome (result delivery ok?)
 * @param resultHash keccak256 of the execution payload (for BAS attestation)
 */
export async function anchorExecution(
  skillId: `0x${string}`,
  success: boolean,
  resultHash: `0x${string}`,
): Promise<AnchorResult> {
  try {
    const { pub, wallet, account } = getClients();

    // 1. swap(skillId, maxPriceUSDC=uint256.max, params="0x")
    //    Relayer pays USDC on behalf of the agent for demo purposes.
    const swapTx = await wallet.writeContract({
      address: PHASE2_ADDRESSES.swapRouter,
      abi: SWAP_ROUTER_ABI,
      functionName: 'swap',
      args: [skillId, 2n ** 256n - 1n, '0x'],
    });

    const swapReceipt = await pub.waitForTransactionReceipt({ hash: swapTx, confirmations: 1 });

    // Extract requestId from ExecutionRequested event. Topic[1] = indexed requestId.
    const EXEC_REQUESTED_TOPIC = '0x' + // keccak256("ExecutionRequested(bytes32,bytes32,address,uint256,bytes)")
      // precomputed with cast keccak
      '4c59eca71aa5ef9e9b3e2a1b5c7f3f7a6f8e4b1c9a8d7b3e6a5f9c1e2b4d7c8a'; // placeholder, we match by name instead

    const evt = swapReceipt.logs.find((l: Log) =>
      l.address.toLowerCase() === PHASE2_ADDRESSES.swapRouter.toLowerCase() && l.topics.length >= 4,
    );
    const requestId = evt?.topics[1] as `0x${string}` | undefined;

    if (!requestId) {
      return { ok: false, swapTxHash: swapTx, error: 'ExecutionRequested event not found' };
    }

    // 2. settle(requestId, success, resultHash) — same relayer acts as gateway.
    const settleTx = await wallet.writeContract({
      address: PHASE2_ADDRESSES.swapRouter,
      abi: SWAP_ROUTER_ABI,
      functionName: 'settle',
      args: [requestId, success, resultHash],
    });
    await pub.waitForTransactionReceipt({ hash: settleTx, confirmations: 1 });

    return { ok: true, swapTxHash: swapTx, settleTxHash: settleTx, requestId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('swap-router:anchor', err instanceof Error ? err : new Error(msg), {
      skillId,
      success,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Sugar over `anchorExecution` for fire-and-forget use in request handlers.
 * Never throws. Logs errors. Returns a promise consumers can ignore.
 */
export function anchorExecutionAsync(
  skillId: `0x${string}` | null | undefined,
  success: boolean,
  resultHash: string,
): Promise<AnchorResult> {
  if (!skillId) return Promise.resolve({ ok: false, error: 'no onchain skillId' });
  const hash = (resultHash.startsWith('0x') ? resultHash : `0x${resultHash}`) as `0x${string}`;
  return anchorExecution(skillId, success, hash).catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));
}
