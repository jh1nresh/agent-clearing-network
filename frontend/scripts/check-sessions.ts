/**
 * Check state of most recent sessions (for E2E verification).
 */
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const sessions = await p.session.findMany({
    orderBy: { openedAt: 'desc' },
    take: 6,
    include: {
      skill: { select: { gatewaySlug: true, name: true } },
      _count: { select: { calls: true } },
    },
  });

  for (const s of sessions) {
    console.log({
      id: s.id,
      skill: s.skill.gatewaySlug ?? s.skill.name,
      status: s.status,
      callCount: s.callCount,
      onchainJobId: s.onchainJobId,
      basUid: s.basAttestationUid?.slice(0, 12) ?? null,
      settledAt: s.settledAt?.toISOString() ?? null,
      calls: s._count.calls,
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
