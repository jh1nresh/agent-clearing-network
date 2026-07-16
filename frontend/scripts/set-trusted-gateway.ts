/**
 * One-time admin script: register the gateway signer address on the ACP contract.
 *
 * Usage: npx tsx scripts/set-trusted-gateway.ts
 *
 * Prerequisites:
 *   - DOJO_RELAYER_PRIVATE_KEY set (relayer must hold ADMIN_ROLE on ACP)
 *   - GATEWAY_SIGNER_PRIVATE_KEY set (or falls back to relayer key for testnet)
 */

import { getGatewayAddress } from '../src/lib/gateway-signer';
import { createBscWalletClient, createBscPublicClient } from '../src/lib/erc8004';
import { getAcpConfig } from '../src/lib/bsc-acp';

const SET_TRUSTED_GATEWAY_ABI = [
  {
    type: 'function',
    name: 'setTrustedGateway',
    inputs: [{ name: 'gateway', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

async function main() {
  const gatewayAddress = getGatewayAddress();
  if (!gatewayAddress) {
    console.error('No gateway key configured. Set GATEWAY_SIGNER_PRIVATE_KEY or DOJO_RELAYER_PRIVATE_KEY.');
    process.exit(1);
  }

  const config = getAcpConfig();
  console.log(`Chain: ${config.chain.name} (${config.chain.id})`);
  console.log(`ACP contract: ${config.acpAddress}`);
  console.log(`Gateway address: ${gatewayAddress}`);

  const wallet = createBscWalletClient();
  const client = createBscPublicClient();

  console.log(`\nSending setTrustedGateway(${gatewayAddress})...`);

  const hash = await wallet.writeContract({
    address: config.acpAddress,
    abi: SET_TRUSTED_GATEWAY_ABI,
    functionName: 'setTrustedGateway',
    args: [gatewayAddress],
  });

  console.log(`Tx submitted: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 15_000 });
  console.log(`Tx confirmed: status=${receipt.status}, block=${receipt.blockNumber}`);

  if (receipt.status === 'success') {
    console.log('\nTrusted gateway registered successfully.');
  } else {
    console.error('\nTransaction reverted. Check that relayer has ADMIN_ROLE on the ACP contract.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
