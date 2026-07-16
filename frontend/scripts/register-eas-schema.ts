/**
 * Register the SKILL_PURCHASE_SCHEMA on EAS (Base Sepolia)
 *
 * Usage: MAIAT_PRIVATE_KEY=0x... npx tsx scripts/register-eas-schema.ts
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const SCHEMA_REGISTRY_ADDRESS: Address = "0x4200000000000000000000000000000000000020";

const SCHEMA_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// Dojo Skill Purchase Schema
const SKILL_PURCHASE_SCHEMA =
  "address buyer,address creator,uint256 skillId,uint256 amount,uint8 rating,bool verified";

async function main() {
  const pk = process.env.MAIAT_PRIVATE_KEY as Hex;
  if (!pk) throw new Error("Set MAIAT_PRIVATE_KEY");

  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  console.log("Registering schema:", SKILL_PURCHASE_SCHEMA);
  console.log("Account:", account.address);

  const txHash = await walletClient.writeContract({
    address: SCHEMA_REGISTRY_ADDRESS,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [
      SKILL_PURCHASE_SCHEMA,
      "0x0000000000000000000000000000000000000000", // no resolver
      false, // not revocable
    ],
  });

  console.log("Tx:", txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  const registeredLog = receipt.logs.find(
    (log) => log.address.toLowerCase() === SCHEMA_REGISTRY_ADDRESS.toLowerCase()
  );
  const schemaUID = registeredLog?.topics?.[1];

  console.log("\n✅ Schema registered!");
  console.log("Schema UID:", schemaUID);
  console.log("\nAdd to .env:");
  console.log(`SKILL_PURCHASE_SCHEMA_UID=${schemaUID}`);
}

main().catch(console.error);
