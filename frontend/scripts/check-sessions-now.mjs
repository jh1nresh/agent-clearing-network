import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const skills = await p.skill.findMany({
  include: {
    _count: { select: { sessions: true } },
    sessions: {
      where: { status: { in: ['settled', 'refunded'] } },
      select: { id: true, status: true, basAttestationUid: true, settledAt: true, callCount: true },
    },
  },
});
for (const s of skills) {
  const settled = s.sessions.length;
  if (settled > 0 || s._count.sessions > 0) {
    console.log(`${s.name}  id=${s.id}  total=${s._count.sessions}  settled=${settled}`);
    for (const sess of s.sessions.slice(0,3)) {
      console.log(`  - ${sess.status}  bas=${sess.basAttestationUid?.slice(0,16)}...  calls=${sess.callCount}`);
    }
  }
}
await p.$disconnect();
