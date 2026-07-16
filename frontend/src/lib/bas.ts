/**
 * BAS (BSC Attestation Service) Integration
 *
 * BAS is EAS-compatible. Same ABI, different contract addresses on BSC.
 * Mainnet only — no BAS on BSC testnet (skip attestation if testnet RPC).
 *
 * Schema: SessionEvaluation
 *   bytes32 sessionId, uint8 finalScore, uint16 callCount, uint8 passRate,
 *   address creatorAddress, address agentAddress, bytes32 merkleRoot
 *
 * merkleRoot: 0x000...000 in Phase 1 (no on-chain dispute).
 *             Populated in Phase 2 (Merkle tree of all SkillCall hashes).
 */

import { encodeAbiParameters, keccak256, parseAbiParameters, parseEventLogs, padHex, toHex } from 'viem';
import { createBscPublicClient, createBscWalletClient, getBscConfig, withRelayerLock } from './erc8004';

// ─── Contract Addresses ─────────────────────────────────────────────────────

export const BAS_ADDRESS = '0x247Fe62d887bc9410c3848DF2f322e52DA9a51bC' as `0x${string}`;
export const BAS_SCHEMA_REGISTRY = '0x5e905F77f59491F03eBB78c204986aaDEB0C6bDa' as `0x${string}`;

// ─── Schema ─────────────────────────────────────────────────────────────────

export const SESSION_EVALUATION_SCHEMA =
  'bytes32 sessionId, uint8 finalScore, uint16 callCount, uint8 passRate, address creatorAddress, address agentAddress, bytes32 merkleRoot';

// Set via env after registering schema on BSC BAS:
//   npx tsx scripts/register-bas-schema.ts
export function getSessionEvaluationSchemaUid(): `0x${string}` | null {
  const uid = process.env.BAS_SESSION_SCHEMA_UID;
  if (!uid || uid === '0x') return null;
  return uid as `0x${string}`;
}

// ─── ABI (EAS-compatible) ───────────────────────────────────────────────────

export const BAS_ABI = [
  {
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'schema', type: 'bytes32' },
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'expirationTime', type: 'uint64' },
              { name: 'revocable', type: 'bool' },
              { name: 'refUID', type: 'bytes32' },
              { name: 'data', type: 'bytes' },
              { name: 'value', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    name: 'attest',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    type: 'event',
    name: 'Attested',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'attester', type: 'address', indexed: true, internalType: 'address' },
      { name: 'uid', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'schemaUID', type: 'bytes32', indexed: true, internalType: 'bytes32' },
    ],
    anonymous: false,
  },
] as const;

export const BAS_SCHEMA_REGISTRY_ABI = [
  {
    inputs: [
      { name: 'schema', type: 'string' },
      { name: 'resolver', type: 'address' },
      { name: 'revocable', type: 'bool' },
    ],
    name: 'register',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ─── Encoding ────────────────────────────────────────────────────────────────

const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/** Encode a string (e.g. cuid session ID) as a right-padded bytes32. */
function sessionIdToBytes32(id: string): `0x${string}` {
  // cuid ≤ 25 chars; assert here so a schema change never silently truncates + collides.
  if (id.length > 31) {
    throw new Error(`sessionIdToBytes32: id too long (${id.length} chars, max 31): ${id}`);
  }
  return padHex(toHex(id), { size: 32 });
}

export interface SessionEvaluationData {
  sessionId: string;           // DB session ID (cuid)
  finalScore: number;          // 0–100 aggregate pass rate
  callCount: number;
  passRate: number;            // 0–100
  creatorAddress: `0x${string}`;
  agentAddress: `0x${string}`;
}

export function encodeSessionEvaluation(data: SessionEvaluationData): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters(SESSION_EVALUATION_SCHEMA),
    [
      sessionIdToBytes32(data.sessionId),
      data.finalScore,
      data.callCount,
      data.passRate,
      data.creatorAddress,
      data.agentAddress,
      ZERO_BYTES32,  // merkleRoot — Phase 2
    ]
  );
}

// ─── Attestation ─────────────────────────────────────────────────────────────

export interface AttestResult {
  success: boolean;
  uid?: `0x${string}`;
  txHash?: `0x${string}`;
  error?: string;
}

/**
 * Submit a SessionEvaluation attestation to BAS on BSC mainnet.
 * Fire-and-forget: caller should not await this in the critical path.
 *
 * Skips gracefully if:
 *   - BSC RPC is testnet (no BAS deployed)
 *   - BAS_SESSION_SCHEMA_UID env not set (schema not registered yet)
 *   - DOJO_RELAYER_PRIVATE_KEY not set
 *
 * Schema (registered via scripts/register-bas-schema.ts):
 *   bytes32 sessionId, uint8 finalScore, uint16 callCount, uint8 passRate,
 *   address creatorAddress, address agentAddress, bytes32 merkleRoot
 */
// Delegate to getBscConfig() so testnet detection logic is in one place.
function isTestnetRpc(): boolean {
  return getBscConfig().isTestnet;
}

/**
 * Generate a deterministic pseudo-UID from session data for testnet mock attestation.
 * keccak256(sessionId + finalScore + callCount) → bytes32
 */
function generateMockUid(data: SessionEvaluationData): `0x${string}` {
  const payload = `${data.sessionId}:${data.finalScore}:${data.callCount}:${data.passRate}`;
  return keccak256(toHex(payload));
}

export async function attestSessionClose(data: SessionEvaluationData): Promise<AttestResult> {
  // Testnet mock — generate deterministic pseudo-UID, skip on-chain call
  if (isTestnetRpc()) {
    const uid = generateMockUid(data);
    console.log('[bas] testnet mock attestation:', { sessionId: data.sessionId, uid });
    return { success: true, uid, txHash: undefined };
  }

  const schemaUid = getSessionEvaluationSchemaUid();
  if (!schemaUid) {
    console.warn('[bas] BAS_SESSION_SCHEMA_UID not set — skipping attestation');
    return { success: false, error: 'schema UID not configured' };
  }

  if (!process.env.DOJO_RELAYER_PRIVATE_KEY) {
    return { success: false, error: 'DOJO_RELAYER_PRIVATE_KEY not set' };
  }

  return withRelayerLock(async () => {
    try {
      const walletClient = createBscWalletClient();
      const publicClient = createBscPublicClient();

      const encoded = encodeSessionEvaluation(data);

      const txHash = await walletClient.writeContract({
        address: BAS_ADDRESS,
        abi: BAS_ABI,
        functionName: 'attest',
        args: [
          {
            schema: schemaUid,
            data: {
              recipient: data.agentAddress,
              expirationTime: 0n,
              revocable: false,
              refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
              data: encoded,
              value: 0n,
            },
          },
        ],
      });

      console.log('[bas] attest tx sent:', txHash);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 20_000,
      });

      if (receipt.status !== 'success') {
        return { success: false, txHash, error: 'attest tx reverted' };
      }

      // Parse true attestation UID from Attested event log.
      // BAS (EAS-compatible) emits: Attested(recipient indexed, attester indexed, uid, schemaUID indexed)
      // uid is non-indexed — lives in log.data as 32 bytes.
      const attestedLogs = parseEventLogs({
        abi: BAS_ABI,
        eventName: 'Attested',
        logs: receipt.logs,
      });
      const uid = attestedLogs[0]?.args.uid;

      if (!uid) {
        console.warn('[bas] Attested event not found in receipt logs — uid undefined:', { txHash, sessionId: data.sessionId });
        return { success: false, txHash, error: 'Attested event not found in logs' };
      }

      console.log('[bas] attestation confirmed:', { txHash, uid, sessionId: data.sessionId, finalScore: data.finalScore });

      return { success: true, txHash, uid };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[bas] attestSessionClose failed:', message);
      return { success: false, error: message };
    }
  });
}
