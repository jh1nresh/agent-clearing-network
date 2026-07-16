/**
 * x402 Payment Integration for Dojo
 *
 * Uses x402 micropayment protocol for skill purchases on X Layer.
 * Reference: https://github.com/x402-foundation/x402
 */

import { verifyTypedData } from 'viem';

// @x402/core bundles a CJS require() shim that breaks webpack client builds.
// Inline the version constant instead of importing the whole package.
const x402Version = 2;

// ─── Chain Configuration ─────────────────────────────────────────────────────

export const X402_CHAINS = {
  bsc: {
    network: 'eip155:56' as const, // BSC Mainnet
    asset: 'USDC',
    usdcAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as `0x${string}`, // USDC on BSC (18 dec)
  },
  bscTestnet: {
    network: 'eip155:97' as const, // BSC Testnet
    asset: 'USDC',
    usdcAddress: '0x2F808cc071D7B54d23a7647d79d7EF6E2C830d31' as `0x${string}`,
  },
  xlayer: {
    network: 'eip155:196' as const, // X Layer Mainnet
    asset: 'USDC',
    usdcAddress: '0x74b7F16337b8972027F6196A17a631aC6dE26d22' as `0x${string}`,
  },
  xlayerTestnet: {
    network: 'eip155:195' as const, // X Layer Testnet
    asset: 'USDC',
    usdcAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  },
} as const;

export type X402Chain = keyof typeof X402_CHAINS;

// ─── Payment Split Configuration ─────────────────────────────────────────────

export const PAYMENT_SPLIT = {
  creator: 95,   // 95% to skill creator
  platform: 5,   // 5% to Maiat platform (Dojo take rate)
} as const;

// ─── Platform Addresses ──────────────────────────────────────────────────────

export const PLATFORM_ADDRESSES = {
  bsc: {
    platform: '0x0000000000000000000000000000000000000001' as `0x${string}`, // TODO: set real address
  },
  bscTestnet: {
    platform: '0x0000000000000000000000000000000000000001' as `0x${string}`, // TODO: set real address
  },
  xlayer: {
    platform: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  },
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface X402PaymentRequest {
  x402Version: number;
  resource: {
    uri: string;
    method: 'POST';
    mimeType: 'application/json';
  };
  accepts: Array<{
    scheme: 'exact';
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
      skillId: string;
      skillName?: string;
    };
  }>;
}

export interface X402PaymentProof {
  x402Version: number;
  resource: {
    uri: string;
    method: string;
  };
  accepted: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
  };
  payload: {
    signature: string;
    authorization?: {
      from: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
}

export interface PaymentSplit {
  creator: bigint;
  platform: bigint;
  total: bigint;
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
  payer?: string;
  amount?: bigint;
  network?: string;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Generate a x402 payment request for a skill purchase
 */
export function generatePaymentRequest(
  skillId: string,
  amount: number,
  currency: 'USDC',
  chain: X402Chain,
  payTo: `0x${string}`,
  skillName?: string
): X402PaymentRequest {
  const chainConfig = X402_CHAINS[chain];

  // BSC USDC (bridged) uses 18 decimals; most other chains (X Layer, etc.) use 6.
  const usdcDecimals = (chain === 'bsc' || chain === 'bscTestnet') ? 1e18 : 1e6;
  const amountInUnits = Math.floor(amount * usdcDecimals).toString();

  return {
    x402Version,
    resource: {
      uri: `/api/skills/${skillId}/buy`,
      method: 'POST',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: chainConfig.network,
        asset: chainConfig.usdcAddress,
        amount: amountInUnits,
        payTo,
        maxTimeoutSeconds: 300, // 5 minutes
        extra: {
          skillId,
          skillName,
        },
      },
    ],
  };
}

/**
 * Verify a x402 payment proof using EIP-712 signature verification
 *
 * Validates the cryptographic signature against the payment authorization data.
 * Uses viem's verifyTypedData for proper EIP-712 verification.
 */
export async function verifyPaymentProof(
  proof: X402PaymentProof,
  expectedPayTo: `0x${string}`
): Promise<VerifyResult> {
  try {
    // Basic structural validation
    if (!proof.x402Version || proof.x402Version < 1) {
      return { valid: false, error: 'Invalid x402 version' };
    }

    if (!proof.accepted?.scheme || !proof.accepted?.network) {
      return { valid: false, error: 'Missing payment scheme or network' };
    }

    if (!proof.payload?.signature) {
      return { valid: false, error: 'Missing payment signature' };
    }

    if (!proof.payload.authorization) {
      return { valid: false, error: 'Missing payment authorization data' };
    }

    const { authorization } = proof.payload;

    // Validate authorization has required fields
    if (!authorization.from || !authorization.nonce) {
      return { valid: false, error: 'Incomplete authorization data' };
    }

    // Validate timing constraints
    const now = Math.floor(Date.now() / 1000);
    if (authorization.validAfter > now) {
      return { valid: false, error: 'Payment authorization not yet valid' };
    }
    if (authorization.validBefore < now) {
      return { valid: false, error: 'Payment authorization expired' };
    }

    // Parse amount
    const amount = BigInt(proof.accepted.amount || '0');
    if (amount <= 0n) {
      return { valid: false, error: 'Invalid payment amount' };
    }

    // Extract chain ID from network string (e.g., "eip155:196" -> 196)
    const chainIdMatch = proof.accepted.network.match(/eip155:(\d+)/);
    if (!chainIdMatch) {
      return { valid: false, error: 'Invalid network format' };
    }
    const chainId = parseInt(chainIdMatch[1], 10);

    // Verify EIP-712 signature using viem
    const isValid = await verifyTypedData({
      address: authorization.from as `0x${string}`,
      domain: getX402Domain(chainId, proof.accepted.asset as `0x${string}`),
      types: X402_PAYMENT_TYPES,
      primaryType: 'PaymentAuthorization',
      message: {
        from: authorization.from as `0x${string}`,
        to: expectedPayTo,
        asset: proof.accepted.asset as `0x${string}`,
        amount,
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        nonce: authorization.nonce as `0x${string}`,
      },
      signature: proof.payload.signature as `0x${string}`,
    });

    if (!isValid) {
      return { valid: false, error: 'Invalid payment signature' };
    }

    return {
      valid: true,
      payer: authorization.from,
      amount,
      network: proof.accepted.network,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Calculate payment split amounts
 * Creator: 95%, Platform: 5% (Dojo take rate on PASS calls only)
 */
export function splitPayment(amount: bigint): PaymentSplit {
  const platformAmount = (amount * BigInt(PAYMENT_SPLIT.platform)) / 100n;

  // Remainder to creator (handles rounding)
  const creatorAmount = amount - platformAmount;

  return {
    creator: creatorAmount,
    platform: platformAmount,
    total: amount,
  };
}

/**
 * Encode payment proof to base64 for HTTP header
 */
export function encodePaymentProof(proof: X402PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString('base64');
}

/**
 * Decode payment proof from base64 HTTP header
 */
export function decodePaymentProof(encoded: string): X402PaymentProof {
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(decoded) as X402PaymentProof;
}

/**
 * EIP-712 typed data for x402 payment authorization
 * Used with viem's signTypedData on the client side
 */
export const X402_PAYMENT_TYPES = {
  PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export function getX402Domain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: 'x402',
    version: '2',
    chainId,
    verifyingContract,
  };
}

/**
 * Get the active chain configuration from environment
 */
export function getActiveX402Chain(): X402Chain {
  const chain = process.env.NEXT_PUBLIC_X402_CHAIN as X402Chain | undefined;
  return chain && chain in X402_CHAINS ? chain : 'bscTestnet';
}

/**
 * Generate x402 payment headers for a 402 response.
 * Agent receives these to discover how to pay for a skill call.
 */
export function generateX402Headers(
  skill: { id: string; name: string; pricePerCall: number | null; gatewaySlug: string | null },
  creatorAddress: `0x${string}`
): Record<string, string> {
  const chain = getActiveX402Chain();
  const chainConfig = X402_CHAINS[chain];
  // BSC USDC (bridged) uses 18 decimals; other chains (X Layer, etc.) use 6.
  const usdcDecimals = (chain === 'bsc' || chain === 'bscTestnet') ? 1e18 : 1e6;
  const amount = Math.floor((skill.pricePerCall ?? 0) * usdcDecimals).toString();

  return {
    'X-Payment-Chain': chainConfig.network,
    'X-Payment-Token': chainConfig.usdcAddress,
    'X-Payment-Amount': amount,
    'X-Payment-Recipient': creatorAddress,
    'X-Payment-SkillId': skill.id,
    'X-Payment-SkillSlug': skill.gatewaySlug ?? '',
    'X-Payment-SkillName': skill.name,
    'X-Payment-Split': `creator:${PAYMENT_SPLIT.creator},platform:${PAYMENT_SPLIT.platform}`,
  };
}
