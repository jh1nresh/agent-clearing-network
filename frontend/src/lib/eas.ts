// ─── EAS (Ethereum Attestation Service) Integration ─────────────────────────
// Base Sepolia EAS Contracts

export const EAS_CONTRACTS = {
  baseSepolia: {
    eas: "0x4200000000000000000000000000000000000021" as `0x${string}`,
    schemaRegistry: "0x4200000000000000000000000000000000000020" as `0x${string}`,
  },
} as const;

// ─── Skill Purchase Attestation Schema ──────────────────────────────────────
// Schema: address buyer, address creator, uint256 skillId, uint256 amount, uint8 rating, bool verified
export const SKILL_PURCHASE_SCHEMA = "address buyer, address creator, uint256 skillId, uint256 amount, uint8 rating, bool verified";

// Registered on Base Sepolia — tx: 0x8f3dafe3a88b11bfb278eb04b4b87698d028774917992ee5e24fd190e292ac7d
export const SKILL_PURCHASE_SCHEMA_UID = "0xef10f3104166bbf8a1fb345e65daf768388abc81cbf83fd0bdde8b0a2b432688" as `0x${string}`;

// ─── ABI Types ──────────────────────────────────────────────────────────────

export const EAS_ABI = [
  {
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    name: "attest",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "uid", type: "bytes32" }],
    name: "getAttestation",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const SCHEMA_REGISTRY_ABI = [
  {
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    name: "register",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── Attestation Data Encoding ──────────────────────────────────────────────

export interface PurchaseAttestationData {
  buyer: `0x${string}`;
  creator: `0x${string}`;
  skillId: bigint;
  amount: bigint;
  rating: number;   // 0-5, 0 = not yet rated
  verified: boolean;
}

/**
 * Encode purchase attestation data for EAS.
 * Uses ABI encoding to pack the attestation data.
 */
export function encodePurchaseAttestation(data: PurchaseAttestationData): `0x${string}` {
  // ABI encode: address buyer, address creator, uint256 skillId, uint256 amount, uint8 rating, bool verified
  // Manual ABI encoding for server-side use without ethers/viem dependency

  const padAddress = (addr: string): string => {
    return addr.toLowerCase().replace("0x", "").padStart(64, "0");
  };

  const padUint256 = (value: bigint): string => {
    return value.toString(16).padStart(64, "0");
  };

  const padUint8 = (value: number): string => {
    return value.toString(16).padStart(64, "0");
  };

  const padBool = (value: boolean): string => {
    return value ? "1".padStart(64, "0") : "0".padStart(64, "0");
  };

  const encoded =
    padAddress(data.buyer) +
    padAddress(data.creator) +
    padUint256(data.skillId) +
    padUint256(data.amount) +
    padUint8(data.rating) +
    padBool(data.verified);

  return `0x${encoded}`;
}

/**
 * Create a purchase attestation request.
 * Returns the encoded data and schema UID for attestation.
 *
 * Note: Actual on-chain attestation requires a wallet transaction.
 * This helper prepares the data for the attest() call.
 */
export function createPurchaseAttestation(
  buyer: `0x${string}`,
  creator: `0x${string}`,
  skillId: bigint,
  amount: bigint
): {
  encodedData: `0x${string}`;
  schemaUid: `0x${string}`;
  attestationRequest: {
    schema: `0x${string}`;
    data: {
      recipient: `0x${string}`;
      expirationTime: bigint;
      revocable: boolean;
      refUID: `0x${string}`;
      data: `0x${string}`;
      value: bigint;
    };
  };
} {
  const attestationData: PurchaseAttestationData = {
    buyer,
    creator,
    skillId,
    amount,
    rating: 0,       // Not yet rated
    verified: true,  // Purchase verified
  };

  const encodedData = encodePurchaseAttestation(attestationData);

  return {
    encodedData,
    schemaUid: SKILL_PURCHASE_SCHEMA_UID,
    attestationRequest: {
      schema: SKILL_PURCHASE_SCHEMA_UID,
      data: {
        recipient: buyer,
        expirationTime: 0n, // No expiration
        revocable: false,   // Purchase attestations are permanent
        refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
        data: encodedData,
        value: 0n,
      },
    },
  };
}

/**
 * Generate a placeholder attestation UID for database storage.
 * This is used until the actual on-chain attestation is created.
 *
 * In production, this would be replaced with the actual attestation UID
 * returned from the EAS contract after the attest() transaction.
 */
export function generatePlaceholderAttestationUid(
  buyer: string,
  skillId: string,
  timestamp: number
): string {
  // Create a deterministic placeholder based on purchase details
  // Format: "pending-{buyer}-{skillId}-{timestamp}"
  return `pending-${buyer.slice(0, 10)}-${skillId}-${timestamp}`;
}
