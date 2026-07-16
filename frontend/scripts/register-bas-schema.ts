/**
 * register-bas-schema.ts
 *
 * One-time script: register the SessionEvaluation schema on BSC mainnet BAS.
 * Run once, then set the returned UID as BAS_SESSION_SCHEMA_UID in env.
 *
 * Usage:
 *   BSC_RPC_URL=https://bsc-dataseed.binance.org \
 *   DOJO_RELAYER_PRIVATE_KEY=0x... \
 *   npx tsx scripts/register-bas-schema.ts
 *
 * Output: BAS_SESSION_SCHEMA_UID=0x...  ← paste into .env.local
 */

import { createBscWalletClient, createBscPublicClient } from '../src/lib/erc8004';
import { BAS_SCHEMA_REGISTRY, BAS_SCHEMA_REGISTRY_ABI, SESSION_EVALUATION_SCHEMA } from '../src/lib/bas';

async function main() {
  const walletClient = createBscWalletClient();
  const publicClient = createBscPublicClient();

  console.log('Registering schema on BAS...');
  console.log('Schema:', SESSION_EVALUATION_SCHEMA);
  console.log('Registry:', BAS_SCHEMA_REGISTRY);

  const txHash = await walletClient.writeContract({
    address: BAS_SCHEMA_REGISTRY,
    abi: BAS_SCHEMA_REGISTRY_ABI,
    functionName: 'register',
    args: [
      SESSION_EVALUATION_SCHEMA,
      '0x0000000000000000000000000000000000000000', // no resolver
      false, // non-revocable
    ],
  });

  console.log('tx:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  if (receipt.status !== 'success') {
    console.error('Transaction reverted');
    process.exit(1);
  }

  // Schema UID is keccak256(schema + resolver + revocable) — read from logs
  // BAS emits Registered(bytes32 indexed uid, address registerer, SchemaRecord)
  const registeredLog = receipt.logs[0];
  const uid = registeredLog?.topics[1];

  if (!uid) {
    console.error('Could not extract UID from logs. Check tx on BscScan:', txHash);
    process.exit(1);
  }

  console.log('\n✅ Schema registered!');
  console.log(`BAS_SESSION_SCHEMA_UID=${uid}`);
  console.log('\nPaste the above line into your .env.local');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
