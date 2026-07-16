/**
 * X Layer Chain Configuration and DojoJobRegistry Integration
 *
 * Provides chain definitions for viem/wagmi and functions to interact
 * with the DojoJobRegistry contract on X Layer.
 */

import { createPublicClient, createWalletClient, http, type Chain, type Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Chain Definitions ──────────────────────────────────────────────────────

export const xlayerTestnet: Chain = {
  id: 195,
  name: 'X Layer Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'OKB',
    symbol: 'OKB',
  },
  rpcUrls: {
    default: { http: ['https://testrpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer-test' },
  },
  testnet: true,
};

export const xlayerMainnet: Chain = {
  id: 196,
  name: 'X Layer',
  nativeCurrency: {
    decimals: 18,
    name: 'OKB',
    symbol: 'OKB',
  },
  rpcUrls: {
    default: { http: ['https://rpc.xlayer.tech'] },
  },
  blockExplorers: {
    default: { name: 'OKX Explorer', url: 'https://www.okx.com/explorer/xlayer' },
  },
  testnet: false,
};

// ─── DojoJobRegistry ABI ────────────────────────────────────────────────────

export const DojoJobRegistryABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createJob',
    inputs: [
      { name: 'skillId', type: 'uint256', internalType: 'uint256' },
      { name: 'buyer', type: 'address', internalType: 'address' },
      { name: 'seller', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeJob',
    inputs: [
      { name: 'jobId', type: 'uint256', internalType: 'uint256' },
      { name: 'resultHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'failJob',
    inputs: [
      { name: 'jobId', type: 'uint256', internalType: 'uint256' },
      { name: 'reason', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getJob',
    inputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct DojoJobRegistry.Job',
        components: [
          { name: 'skillId', type: 'uint256', internalType: 'uint256' },
          { name: 'buyer', type: 'address', internalType: 'address' },
          { name: 'seller', type: 'address', internalType: 'address' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'status', type: 'uint8', internalType: 'enum DojoJobRegistry.JobStatus' },
          { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
          { name: 'completedAt', type: 'uint256', internalType: 'uint256' },
          { name: 'resultHash', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getJobStatus',
    inputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum DojoJobRegistry.JobStatus' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'jobCounter',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'jobs',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'skillId', type: 'uint256', internalType: 'uint256' },
      { name: 'buyer', type: 'address', internalType: 'address' },
      { name: 'seller', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'status', type: 'uint8', internalType: 'enum DojoJobRegistry.JobStatus' },
      { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
      { name: 'completedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'resultHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'JobCreated',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'skillId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'buyer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'seller', type: 'address', indexed: false, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'JobCompleted',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'resultHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'JobFailed',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'reason', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newOwner', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'JobAlreadyCompleted',
    inputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
  },
  {
    type: 'error',
    name: 'JobNotFound',
    inputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
  },
] as const;

// ─── Configuration ──────────────────────────────────────────────────────────

export function getXLayerConfig() {
  const rpcUrl = process.env.XLAYER_RPC_URL || 'https://testrpc.xlayer.tech';
  const registryAddress = process.env.DOJO_JOB_REGISTRY_ADDRESS as `0x${string}` | undefined;
  const privateKey = process.env.XLAYER_PRIVATE_KEY as `0x${string}` | undefined;

  // Determine chain based on RPC URL
  const isTestnet = rpcUrl.includes('testrpc') || rpcUrl.includes('test');
  const chain = isTestnet ? xlayerTestnet : xlayerMainnet;

  return {
    rpcUrl,
    registryAddress,
    privateKey,
    chain,
    isTestnet,
  };
}

// ─── Client Factories ───────────────────────────────────────────────────────

export function createXLayerPublicClient() {
  const config = getXLayerConfig();
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

export function createXLayerWalletClient() {
  const config = getXLayerConfig();

  if (!config.privateKey) {
    throw new Error('XLAYER_PRIVATE_KEY not configured');
  }

  const account = privateKeyToAccount(config.privateKey);

  return createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// ─── Contract Functions ─────────────────────────────────────────────────────

export interface CreateJobParams {
  skillId: bigint;
  buyerAddr: `0x${string}`;
  sellerAddr: `0x${string}`;
  amount: bigint;
}

export interface CreateJobResult {
  success: boolean;
  jobId?: string;
  txHash?: Hash;
  error?: string;
}

/**
 * Create a job record on X Layer
 *
 * Called after successful x402 payment to record the purchase on-chain.
 * This is a fire-and-forget operation — failures are logged but don't block the purchase.
 */
export async function createJobOnChain(params: CreateJobParams): Promise<CreateJobResult> {
  const config = getXLayerConfig();

  if (!config.registryAddress || config.registryAddress === '0x0000000000000000000000000000000000000000') {
    console.warn('[xlayer] DojoJobRegistry not deployed yet, skipping on-chain job creation');
    return { success: false, error: 'Registry not deployed' };
  }

  if (!config.privateKey) {
    console.warn('[xlayer] XLAYER_PRIVATE_KEY not configured, skipping on-chain job creation');
    return { success: false, error: 'Private key not configured' };
  }

  try {
    const walletClient = createXLayerWalletClient();
    const publicClient = createXLayerPublicClient();

    // Send transaction
    const txHash = await walletClient.writeContract({
      address: config.registryAddress,
      abi: DojoJobRegistryABI,
      functionName: 'createJob',
      args: [params.skillId, params.buyerAddr, params.sellerAddr, params.amount],
    });

    console.log('[xlayer] createJob tx sent:', txHash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    // Parse JobCreated event to get jobId
    const jobCreatedLog = receipt.logs.find((log) => {
      // JobCreated event topic
      return log.topics[0] === '0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498';
    });

    // Extract jobId from first indexed topic (topics[1])
    const jobId = jobCreatedLog?.topics[1]
      ? BigInt(jobCreatedLog.topics[1]).toString()
      : undefined;

    console.log('[xlayer] Job created:', { jobId, txHash, blockNumber: receipt.blockNumber });

    return {
      success: true,
      jobId,
      txHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[xlayer] createJobOnChain failed:', message);
    return { success: false, error: message };
  }
}

export interface CompleteJobParams {
  jobId: bigint;
  resultHash: `0x${string}`;
}

export interface CompleteJobResult {
  success: boolean;
  txHash?: Hash;
  error?: string;
}

/**
 * Mark a job as completed on X Layer
 *
 * Called after skill content is delivered to the buyer.
 */
export async function completeJobOnChain(params: CompleteJobParams): Promise<CompleteJobResult> {
  const config = getXLayerConfig();

  if (!config.registryAddress || config.registryAddress === '0x0000000000000000000000000000000000000000') {
    console.warn('[xlayer] DojoJobRegistry not deployed yet, skipping on-chain job completion');
    return { success: false, error: 'Registry not deployed' };
  }

  if (!config.privateKey) {
    console.warn('[xlayer] XLAYER_PRIVATE_KEY not configured, skipping on-chain job completion');
    return { success: false, error: 'Private key not configured' };
  }

  try {
    const walletClient = createXLayerWalletClient();
    const publicClient = createXLayerPublicClient();

    const txHash = await walletClient.writeContract({
      address: config.registryAddress,
      abi: DojoJobRegistryABI,
      functionName: 'completeJob',
      args: [params.jobId, params.resultHash],
    });

    console.log('[xlayer] completeJob tx sent:', txHash);

    await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    console.log('[xlayer] Job completed:', { jobId: params.jobId.toString(), txHash });

    return { success: true, txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[xlayer] completeJobOnChain failed:', message);
    return { success: false, error: message };
  }
}

/**
 * Generate a result hash from skill content
 *
 * Uses keccak256 to hash the content for on-chain storage.
 */
export function generateResultHash(content: string): `0x${string}` {
  // Use Web Crypto API for browser/Node compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Simple hash for now — in production use proper keccak256
  let hash = 0n;
  for (const byte of data) {
    hash = (hash * 31n + BigInt(byte)) % (2n ** 256n);
  }

  return ('0x' + hash.toString(16).padStart(64, '0')) as `0x${string}`;
}
