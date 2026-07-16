/**
 * Gateway Signer — ERC-8183 closeAndSettle() evaluation proof
 *
 * Signs evaluation proofs matching the contract's ECDSA verification:
 *   keccak256(abi.encodePacked(chainId, contract, jobId, finalScore, callCount, passRate))
 *   → toEthSignedMessageHash → ECDSA.recover → must == trustedGateway
 *
 * Phase 1: GATEWAY_SIGNER_PRIVATE_KEY = DOJO_RELAYER_PRIVATE_KEY (same wallet).
 * Phase 2+: separate key, separate role.
 */

import { privateKeyToAccount } from 'viem/accounts';
import { encodePacked, keccak256 } from 'viem';

function getGatewayKey(): `0x${string}` | undefined {
  return (process.env.GATEWAY_SIGNER_PRIVATE_KEY
    || process.env.DOJO_RELAYER_PRIVATE_KEY) as `0x${string}` | undefined;
}

export interface EvaluationProofParams {
  chainId: number;
  contractAddress: `0x${string}`;
  jobId: bigint;
  finalScore: number;    // 0-100
  callCount: number;
  passRate: number;      // 0-100
}

/**
 * Sign an evaluation proof for closeAndSettle().
 *
 * Uses signMessage (personal_sign) which prepends "\x19Ethereum Signed Message:\n32",
 * matching the contract's MessageHashUtils.toEthSignedMessageHash().
 */
export async function signEvaluationProof(params: EvaluationProofParams): Promise<`0x${string}`> {
  const key = getGatewayKey();
  if (!key) throw new Error('No gateway signer key configured (GATEWAY_SIGNER_PRIVATE_KEY or DOJO_RELAYER_PRIVATE_KEY)');

  const account = privateKeyToAccount(key);

  // Must match contract: keccak256(abi.encodePacked(chainId, address, jobId, finalScore, callCount, passRate))
  const packed = encodePacked(
    ['uint256', 'address', 'uint256', 'uint8', 'uint16', 'uint8'],
    [
      BigInt(params.chainId),
      params.contractAddress,
      params.jobId,
      params.finalScore,
      params.callCount,
      params.passRate,
    ]
  );
  const digest = keccak256(packed);

  // signMessage adds the EIP-191 prefix, matching contract's toEthSignedMessageHash
  return account.signMessage({ message: { raw: digest } });
}

/** Returns the gateway signer address, or null if no key configured. */
export function getGatewayAddress(): `0x${string}` | null {
  const key = getGatewayKey();
  if (!key) return null;
  return privateKeyToAccount(key).address;
}
