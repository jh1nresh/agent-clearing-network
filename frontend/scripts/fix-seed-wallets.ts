/**
 * Fix seed users that have invalid placeholder wallet addresses like
 * "0x000000000000000000000000000000000000dojo" (contains non-hex chars).
 * Replaces them with deterministic valid addresses so trust-oracle + BAS can run.
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

const patches: Array<{ privyId: string; walletAddress: `0x${string}` }> = [
  // Creator — used by echo-test & other seeded skills
  { privyId: 'did:privy:seed-platform-001', walletAddress: '0x1111111111111111111111111111111111111111' },
  // Other platform seed (if present)
  { privyId: 'did:privy:seed-sentinel-002', walletAddress: '0x2222222222222222222222222222222222222222' },
  // Buyer seed — no wallet, give it one so E2E sessions have an agent.walletAddress
  { privyId: 'did:privy:seed-buyer-003',    walletAddress: '0x3333333333333333333333333333333333333333' },
];

async function main() {
  for (const patch of patches) {
    const user = await p.user.findUnique({ where: { privyId: patch.privyId } });
    if (!user) {
      console.log('skip (not found):', patch.privyId);
      continue;
    }
    const needsPatch = !user.walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(user.walletAddress);
    if (!needsPatch) {
      console.log('skip (already valid):', patch.privyId, user.walletAddress);
      continue;
    }
    await p.user.update({
      where: { privyId: patch.privyId },
      data: { walletAddress: patch.walletAddress },
    });
    console.log('patched:', patch.privyId, '→', patch.walletAddress);
  }

  // Agents: ensure at least the buyer's agent has a wallet too, since the
  // session-close code requires session.agent.walletAddress for BAS attestation.
  const buyer = await p.user.findUnique({ where: { privyId: 'did:privy:seed-buyer-003' } });
  if (buyer) {
    const agents = await p.agent.findMany({ where: { ownerId: buyer.id } });
    for (const a of agents) {
      if (!a.walletAddress) {
        await p.agent.update({ where: { id: a.id }, data: { walletAddress: '0x3333333333333333333333333333333333333333' } });
        console.log('patched agent:', a.name, '→ 0x3333...');
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
