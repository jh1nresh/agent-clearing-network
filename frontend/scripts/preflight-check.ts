import { createPublicClient, http, parseAbi, formatEther, keccak256, toHex } from 'viem';
import { bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { PrismaClient } from '@prisma/client';

const RPC = process.env.BSC_RPC_URL!;
const PK = process.env.DOJO_RELAYER_PRIVATE_KEY! as `0x${string}`;
const DOJO_TRUST = '0xC6cF2d59fF2e4EE64bbfcEaad8Dcb9aA3F13c6dA' as const;
const ACP = '0x1C86C5cAC643325534Ac2198f55B32A7A613f9F8' as const;
const MOCK_USDC = '0x2F808cc071D7B54d23a7647d79d7EF6E2C830d31' as const;

async function main() {
  console.log('RPC:', RPC);
  const client = createPublicClient({ chain: bscTestnet, transport: http(RPC) });
  const chainId = await client.getChainId();
  console.log('chainId:', chainId);

  const relayer = privateKeyToAccount(PK);
  console.log('relayer:', relayer.address);

  const bnb = await client.getBalance({ address: relayer.address });
  console.log('relayer tBNB:', formatEther(bnb));

  // MockUSDC balance
  const usdc = await client.readContract({
    address: MOCK_USDC,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)']),
    functionName: 'balanceOf',
    args: [relayer.address],
  }) as bigint;
  const dec = await client.readContract({
    address: MOCK_USDC,
    abi: parseAbi(['function decimals() view returns (uint8)']),
    functionName: 'decimals',
  }) as number;
  console.log(`relayer MockUSDC: ${Number(usdc)/10**dec} (dec=${dec})`);

  // EVALUATOR_ROLE
  const role = keccak256(toHex('EVALUATOR_ROLE'));
  console.log('EVALUATOR_ROLE hash:', role);
  const hasRole = await client.readContract({
    address: DOJO_TRUST,
    abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
    functionName: 'hasRole',
    args: [role, relayer.address],
  });
  console.log('relayer hasRole(EVALUATOR_ROLE):', hasRole);

  // DEFAULT_ADMIN_ROLE — relayer is likely admin
  const admin = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
  const isAdmin = await client.readContract({
    address: DOJO_TRUST,
    abi: parseAbi(['function hasRole(bytes32,address) view returns (bool)']),
    functionName: 'hasRole',
    args: [admin, relayer.address],
  });
  console.log('relayer hasRole(DEFAULT_ADMIN):', isAdmin);

  // DB seed check
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  const agentCount = await prisma.agent.count();
  const skillCount = await prisma.skill.count();
  const echo = await prisma.skill.findFirst({ where: { gatewaySlug: 'echo-test' }, select: { id: true, name: true, gatewaySlug: true, creatorId: true, endpointUrl: true } });
  console.log('\nDB state:');
  console.log('  users:', userCount, 'agents:', agentCount, 'skills:', skillCount);
  console.log('  echo-test skill:', echo);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
