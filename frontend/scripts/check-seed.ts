import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({ select: { id: true, privyId: true, displayName: true, walletAddress: true } });
  console.log('users:');
  for (const u of users) console.log(' ', u);
  const agents = await p.agent.findMany({ select: { id: true, name: true, walletAddress: true, ownerId: true } });
  console.log('\nagents:');
  for (const a of agents) console.log(' ', a);
  const skill = await p.skill.findFirst({ where: { gatewaySlug: 'echo-test' }, include: { creator: { select: { id: true, walletAddress: true } } } });
  console.log('\necho skill creator wallet:', skill?.creator.walletAddress);
  await p.$disconnect();
}
main().catch(console.error);
