/**
 * ERC-8183 AgenticCommerceHooked Integration
 *
 * Chain-agnostic: reads addresses from contracts.ts (ACTIVE_CHAIN).
 * Relayer is job.client AND job.provider for Phase 1 — no creator wallet needed.
 *
 * Full lifecycle:
 *   createJob  → session open  (job = Open)
 *   fundJob    → session open  (job = Funded, USDC locked in escrow)
 *   submitJob  → session close (job = Submitted, relayer delivers result hash)
 *   evaluateJob → session close (TrustBasedEvaluator → complete/reject → USDC released)
 *
 * Env overrides (local dev / CI):
 *   BSC_ACP_ADDRESS       — AgenticCommerceHooked
 *   BSC_EVALUATOR_ADDRESS — TrustBasedEvaluator
 */

import { parseEventLogs, keccak256, toBytes, type Hash } from 'viem';
import { createBscPublicClient, createBscWalletClient, getBscConfig, withRelayerLock } from './erc8004';
import { getContracts } from './contracts';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ACP_ABI = [
  {
    type: 'function', name: 'createJob',
    inputs: [
      { name: 'provider',   type: 'address' },
      { name: 'evaluator',  type: 'address' },
      { name: 'expiredAt',  type: 'uint256' },
      { name: 'description', type: 'string' },
      { name: 'hook',       type: 'address' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'setBudget',
    inputs: [
      { name: 'jobId',     type: 'uint256' },
      { name: 'amount',    type: 'uint256' },
      { name: 'optParams', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'fund',
    inputs: [
      { name: 'jobId',          type: 'uint256' },
      { name: 'expectedBudget', type: 'uint256' },
      { name: 'optParams',      type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'submit',
    inputs: [
      { name: 'jobId',       type: 'uint256' },
      { name: 'deliverable', type: 'bytes32' },
      { name: 'optParams',   type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'closeAndSettle',
    inputs: [
      { name: 'jobId',            type: 'uint256' },
      { name: 'finalScore',       type: 'uint8' },
      { name: 'callCount',        type: 'uint16' },
      { name: 'passRate',         type: 'uint8' },
      { name: 'gatewaySignature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event', name: 'JobCreated',
    inputs: [
      { name: 'jobId',     type: 'uint256', indexed: true },
      { name: 'client',    type: 'address', indexed: true },
      { name: 'provider',  type: 'address', indexed: true },
      { name: 'evaluator', type: 'address', indexed: false },
      { name: 'expiredAt', type: 'uint256', indexed: false },
      { name: 'hook',      type: 'address', indexed: false },
    ],
    anonymous: false,
  },
] as const;

const EVALUATOR_ABI = [
  {
    type: 'function', name: 'evaluate',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function', name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ─── Config ───────────────────────────────────────────────────────────────────

export function getAcpConfig() {
  const chain = getBscConfig();
  const contracts = getContracts();
  return {
    ...chain,
    acpAddress:       (process.env.BSC_ACP_ADDRESS       ?? contracts.agenticCommerceHooked) as `0x${string}`,
    evaluatorAddress: (process.env.BSC_EVALUATOR_ADDRESS ?? contracts.trustBasedEvaluator)   as `0x${string}`,
    hookAddress:      contracts.compositeRouterHook,
    usdcAddress:      contracts.usdc,
  };
}

/** Returns null if configured, or an error string naming the missing config. */
function getMissingConfig(config: ReturnType<typeof getAcpConfig>): string | null {
  if (!config.privateKey)                            return 'DOJO_RELAYER_PRIVATE_KEY not set';
  if (!config.acpAddress || config.acpAddress === ZERO)
                                                     return 'BSC_ACP_ADDRESS not configured';
  if (!config.evaluatorAddress || config.evaluatorAddress === ZERO)
                                                     return 'BSC_EVALUATOR_ADDRESS not configured';
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcpResult {
  success: boolean;
  txHash?: Hash;
  jobId?: string;
  error?: string;
}

// ─── createJob ────────────────────────────────────────────────────────────────

export interface CreateJobParams {
  description: string;
  expiredAt: bigint;       // unix timestamp
  budgetUsdc: bigint;      // USDC amount (18 dec on BSC)
  provider?: `0x${string}`;  // real creator wallet. Falls back to relayer if omitted.
}

/**
 * createJob + fund in one atomic call sequence.
 * Relayer is both client and provider (Phase 1).
 * Returns jobId for DB binding.
 *
 * @deprecated Use /api/sessions/prepare + agent wallet txs + /api/sessions/confirm instead.
 * Kept for backward compat (scripts, old sessions/open endpoint).
 */
export async function createSessionOnChain(params: CreateJobParams): Promise<AcpResult> {
  console.warn('[acp] createSessionOnChain is deprecated — use prepare/confirm flow for agent self-pay');
  const config = getAcpConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig) return { success: false, error: missingConfig };

  if (config.usdcAddress === ZERO) {
    console.warn('[acp] usdc not configured — skipping on-chain binding');
    return { success: false, error: 'usdc not configured' };
  }

  return withRelayerLock(async () => {
    try {
      const wallet = createBscWalletClient();
      const client = createBscPublicClient();
      const relayer = wallet.account.address;

      // 1. createJob — provider = real creator wallet (or relayer fallback)
      // msg.sender (relayer) becomes the on-chain client.
      // Phase 1: hook = address(0) — relayer has no trust score, TrustGateACPHook
      // would revert if wired. Phase 2: switch to config.hookAddress when agents
      // have registered trust scores.
      const providerAddr = params.provider || relayer;
      const createHash = await wallet.writeContract({
        address: config.acpAddress,
        abi: ACP_ABI,
        functionName: 'createJob',
        args: [providerAddr, config.evaluatorAddress, params.expiredAt, params.description, ZERO],
      });
      const createReceipt = await client.waitForTransactionReceipt({ hash: createHash, confirmations: 1, timeout: 15_000 });
      if (createReceipt.status !== 'success') return { success: false, txHash: createHash, error: 'createJob reverted' };

      const jobLogs = parseEventLogs({ abi: ACP_ABI, eventName: 'JobCreated', logs: createReceipt.logs });
      const jobId = jobLogs[0]?.args.jobId;
      if (!jobId) return { success: false, txHash: createHash, error: 'JobCreated event not found' };

      console.log('[acp] createJob:', { jobId: jobId.toString(), txHash: createHash });

      // 2. setBudget (createJob initializes budget=0; fund() requires budget == expectedBudget && budget != 0)
      const setBudgetHash = await wallet.writeContract({
        address: config.acpAddress, abi: ACP_ABI, functionName: 'setBudget',
        args: [jobId, params.budgetUsdc, '0x'],
      });
      const setBudgetReceipt = await client.waitForTransactionReceipt({ hash: setBudgetHash, confirmations: 1, timeout: 15_000 });
      if (setBudgetReceipt.status !== 'success') return { success: false, txHash: setBudgetHash, error: 'setBudget reverted' };
      console.log('[acp] setBudget:', { jobId: jobId.toString(), budget: params.budgetUsdc.toString(), txHash: setBudgetHash });

      // 3. approve USDC if needed
      const allowance = await client.readContract({
        address: config.usdcAddress, abi: ERC20_ABI, functionName: 'allowance',
        args: [relayer, config.acpAddress],
      });
      if (allowance < params.budgetUsdc) {
        const approveHash = await wallet.writeContract({
          address: config.usdcAddress, abi: ERC20_ABI, functionName: 'approve',
          args: [config.acpAddress, params.budgetUsdc],
        });
        const approveReceipt = await client.waitForTransactionReceipt({ hash: approveHash, confirmations: 1, timeout: 15_000 });
        if (approveReceipt.status !== 'success') return { success: false, txHash: approveHash, error: 'approve reverted' };
        console.log('[acp] USDC approved:', approveHash);
      }

      // 4. fund
      const fundHash = await wallet.writeContract({
        address: config.acpAddress, abi: ACP_ABI, functionName: 'fund',
        args: [jobId, params.budgetUsdc, '0x'],
      });
      const fundReceipt = await client.waitForTransactionReceipt({ hash: fundHash, confirmations: 1, timeout: 15_000 });
      if (fundReceipt.status !== 'success') return { success: false, txHash: fundHash, error: 'fund reverted' };

      console.log('[acp] funded:', { jobId: jobId.toString(), budget: params.budgetUsdc.toString(), txHash: fundHash });
      return { success: true, jobId: jobId.toString(), txHash: fundHash };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[acp] createSessionOnChain failed:', message);
      return { success: false, error: message };
    }
  });
}

// ─── settleSessionOnChain ─────────────────────────────────────────────────────

export interface SettleJobParams {
  jobId: string;
  sessionId: string;    // used to derive deterministic deliverable hash
  callCount: number;
}

/**
 * submit + evaluate in sequence.
 * Relayer submits deliverable hash, then TrustBasedEvaluator decides complete/reject.
 */
export async function settleSessionOnChain(params: SettleJobParams): Promise<AcpResult> {
  const config = getAcpConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig) return { success: false, error: missingConfig };

  return withRelayerLock(async () => {
    try {
      const wallet = createBscWalletClient();
      const client = createBscPublicClient();
      const jobId = BigInt(params.jobId);

      // 1. submit (deterministic hash from sessionId + callCount)
      const deliverable = keccak256(toBytes(`${params.sessionId}:${params.callCount}`)) as `0x${string}`;
      const submitHash = await wallet.writeContract({
        address: config.acpAddress, abi: ACP_ABI, functionName: 'submit',
        args: [jobId, deliverable, '0x'],
      });
      const submitReceipt = await client.waitForTransactionReceipt({ hash: submitHash, confirmations: 1, timeout: 15_000 });
      if (submitReceipt.status !== 'success') return { success: false, txHash: submitHash, error: 'submit reverted' };

      console.log('[acp] submitted:', { jobId: params.jobId, deliverable, txHash: submitHash });

      // 2. evaluate (TrustBasedEvaluator → complete or reject)
      const evalHash = await wallet.writeContract({
        address: config.evaluatorAddress, abi: EVALUATOR_ABI, functionName: 'evaluate',
        args: [jobId],
      });
      const evalReceipt = await client.waitForTransactionReceipt({ hash: evalHash, confirmations: 1, timeout: 20_000 });
      if (evalReceipt.status !== 'success') return { success: false, txHash: evalHash, error: 'evaluate reverted' };

      console.log('[acp] evaluated:', { jobId: params.jobId, txHash: evalHash });
      return { success: true, jobId: params.jobId, txHash: evalHash };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[acp] settleSessionOnChain failed:', message);
      return { success: false, error: message };
    }
  });
}

// ─── closeAndSettleOnChain ─────────────────────────────────────────────────────

export interface CloseAndSettleParams {
  jobId: bigint;
  finalScore: number;    // 0-100
  callCount: number;
  passRate: number;      // 0-100
  gatewaySignature: `0x${string}`;
}

/**
 * Call closeAndSettle() — atomic settlement with gateway-signed evaluation proof.
 * Handles PASS (pay provider 95%, treasury 5%) and FAIL (refund client 100%).
 * AfterAction hooks fire attestation + trust update in the same tx.
 *
 * Anyone can call — relayer submits tx, gateway signature proves evaluation.
 */
export async function closeAndSettleOnChain(params: CloseAndSettleParams): Promise<AcpResult> {
  const config = getAcpConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig) return { success: false, error: missingConfig };

  return withRelayerLock(async () => {
    try {
      const wallet = createBscWalletClient();
      const client = createBscPublicClient();

      const hash = await wallet.writeContract({
        address: config.acpAddress,
        abi: ACP_ABI,
        functionName: 'closeAndSettle',
        args: [params.jobId, params.finalScore, params.callCount, params.passRate, params.gatewaySignature],
      });
      const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 20_000 });
      if (receipt.status !== 'success') return { success: false, txHash: hash, error: 'closeAndSettle reverted' };

      console.log('[acp] closeAndSettle:', {
        jobId: params.jobId.toString(),
        finalScore: params.finalScore,
        passRate: params.passRate,
        txHash: hash,
      });
      return { success: true, jobId: params.jobId.toString(), txHash: hash };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[acp] closeAndSettleOnChain failed:', message);
      return { success: false, error: message };
    }
  });
}
