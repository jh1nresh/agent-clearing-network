/**
 * ERC-8004 Agent Identity — BSC Integration
 *
 * Wraps the AgentIdentity contract (maiat-protocol) deployed on BSC.
 * The relayer calls registerFor() on behalf of users so they don't pay gas.
 *
 * Confirmed ABI (from AgentIdentity.sol):
 *   registerFor(address wallet, string agentURI) onlyOwner → uint256 agentId
 *   agentIdOf(address wallet) view → uint256 (0 if not registered)
 *   isRegistered(address wallet) view → bool
 */

import { createPublicClient, createWalletClient, http, type Chain, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Chain Definitions ──────────────────────────────────────────────────────

export const bscTestnet: Chain = {
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: { decimals: 18, name: 'BNB', symbol: 'tBNB' },
  rpcUrls: {
    default: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
};

export const bscMainnet: Chain = {
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { decimals: 18, name: 'BNB', symbol: 'BNB' },
  rpcUrls: {
    default: { http: ['https://bsc-dataseed.binance.org'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' },
  },
  testnet: false,
};

// ─── AgentIdentity ABI ──────────────────────────────────────────────────────

export const AgentIdentityABI = [
  {
    type: 'function',
    name: 'registerFor',
    inputs: [
      { name: 'wallet', type: 'address', internalType: 'address' },
      { name: 'agentURI', type: 'string', internalType: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'agentIdOf',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'agentURI', type: 'string', indexed: false, internalType: 'string' },
    ],
    anonymous: false,
  },
] as const;

// ─── Configuration ──────────────────────────────────────────────────────────

export function getBscConfig() {
  const rpcUrl = process.env.BSC_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545';
  const contractAddress = (process.env.ERC8004_ADDRESS ?? '0xbb1d304179bdd577d5ef15fec91a5ba9756a6e41') as `0x${string}`;
  const privateKey = process.env.DOJO_RELAYER_PRIVATE_KEY as `0x${string}` | undefined;

  const isTestnet = rpcUrl.includes('testnet') || rpcUrl.includes('prebsc') || rpcUrl.includes('97');
  const chain = isTestnet ? bscTestnet : bscMainnet;

  return { rpcUrl, contractAddress, privateKey, chain, isTestnet };
}

// ─── Client Factories (shared across erc8004, bsc-acp, bas) ─────────────────

export function createBscPublicClient() {
  const config = getBscConfig();
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

export function createBscWalletClient() {
  const config = getBscConfig();
  if (!config.privateKey) {
    throw new Error('DOJO_RELAYER_PRIVATE_KEY not configured');
  }
  return createWalletClient({
    account: privateKeyToAccount(config.privateKey),
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// ─── Relayer Tx Lock ────────────────────────────────────────────────────────
// Ensures sequential nonce usage across all fire-and-forget relayer paths
// (erc8004 mint, bsc-acp createJob, bas attest). Without this, concurrent
// requests fetch the same nonce from the RPC and one tx fails.

let _relayerQueue: Promise<void> = Promise.resolve();

export function withRelayerLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _relayerQueue;
  let release: () => void;
  _relayerQueue = new Promise<void>(r => { release = r; });
  return prev.then(() => fn()).finally(() => release!());
}

// ─── Contract Functions ─────────────────────────────────────────────────────

export interface MintIdentityResult {
  success: boolean;
  agentId?: bigint;
  txHash?: Hash;
  error?: string;
}

/**
 * Mint an ERC-8004 agent identity for a wallet address.
 * Relayer submits the tx — user pays no gas.
 * Wrapped in relayer lock to prevent nonce collisions with concurrent txs.
 */
export async function mintIdentityFor(walletAddress: `0x${string}`): Promise<MintIdentityResult> {
  const config = getBscConfig();

  if (!config.privateKey) {
    return { success: false, error: 'DOJO_RELAYER_PRIVATE_KEY not configured' };
  }

  return withRelayerLock(async () => {
    try {
      const walletClient = createBscWalletClient();
      const publicClient = createBscPublicClient();

      const txHash = await walletClient.writeContract({
        address: config.contractAddress,
        abi: AgentIdentityABI,
        functionName: 'registerFor',
        args: [walletAddress, ''],
      });

      console.log('[erc8004] registerFor tx sent:', txHash, 'wallet:', walletAddress);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 15_000,
      });

      if (receipt.status !== 'success') {
        return { success: false, txHash, error: 'Transaction reverted' };
      }

      // Read agentId from on-chain state (simpler than parsing Registered event)
      const agentId = await publicClient.readContract({
        address: config.contractAddress,
        abi: AgentIdentityABI,
        functionName: 'agentIdOf',
        args: [walletAddress],
      });

      console.log('[erc8004] registered:', { walletAddress, agentId: agentId.toString(), txHash });

      return { success: true, agentId, txHash };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[erc8004] mintIdentityFor failed:', message);
      return { success: false, error: message };
    }
  });
}

/**
 * Read the on-chain agentId for a wallet.
 * Returns 0n if not registered. Throws on RPC/network errors so callers
 * can distinguish "not registered" from "node unreachable".
 */
export async function getAgentIdOf(walletAddress: `0x${string}`): Promise<bigint> {
  const config = getBscConfig();
  const publicClient = createBscPublicClient();
  return await publicClient.readContract({
    address: config.contractAddress,
    abi: AgentIdentityABI,
    functionName: 'agentIdOf',
    args: [walletAddress],
  });
}

/**
 * Check if a wallet already has an identity on-chain.
 */
export async function isIdentityRegistered(walletAddress: `0x${string}`): Promise<boolean> {
  const config = getBscConfig();
  const publicClient = createBscPublicClient();
  try {
    return await publicClient.readContract({
      address: config.contractAddress,
      abi: AgentIdentityABI,
      functionName: 'isRegistered',
      args: [walletAddress],
    });
  } catch (err) {
    console.error('[erc8004] isIdentityRegistered RPC error:', err instanceof Error ? err.message : err);
    throw err;
  }
}
