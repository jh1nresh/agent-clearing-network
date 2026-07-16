// Seed synthetic sessions + calls on Echo Test for TrustCard demo
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const ECHO_ID = 'cmns8ip5v000iorat4jot4lg3';

// Clean previous demo data
await p.skillCall.deleteMany({ where: { session: { skillId: ECHO_ID } } });
await p.session.deleteMany({ where: { skillId: ECHO_ID } });

const skill = await p.skill.findUnique({ where: { id: ECHO_ID } });
if (!skill) {
  console.error('Echo Test not found');
  process.exit(1);
}

// Get or create a demo buyer user + agent
let buyer = await p.user.findFirst({ where: { walletAddress: '0xdemoBuyerA11eE00000000000000000000000000' } });
if (!buyer) {
  buyer = await p.user.create({
    data: {
      walletAddress: '0xdemoBuyerA11eE00000000000000000000000000',
      displayName: 'demo-agent',
    },
  });
}

let agent = await p.agent.findFirst({ where: { ownerId: buyer.id } });
if (!agent) {
  agent = await p.agent.create({
    data: {
      name: 'Demo Agent',
      description: 'Synthetic buyer for TrustCard demo',
      ownerId: buyer.id,
    },
  });
}

// Give the creator an ERC-8004 KYA tokenId so TrustCard shows "verified"
await p.user.update({
  where: { id: skill.creatorId },
  data: { erc8004TokenId: 42n },
});

const now = Date.now();
const DAY = 86_400_000;
const sessions = [
  // 6 days ago, 2 settled
  { dayOffset: 6, status: 'settled', callCount: 3, latencies: [210, 240, 190] },
  { dayOffset: 6, status: 'settled', callCount: 2, latencies: [180, 200] },
  // 5 days ago, 1 refunded
  { dayOffset: 5, status: 'refunded', callCount: 1, latencies: [4500] },
  // 4 days ago, 2 settled
  { dayOffset: 4, status: 'settled', callCount: 4, latencies: [220, 260, 205, 195] },
  { dayOffset: 4, status: 'settled', callCount: 2, latencies: [175, 215] },
  // 3 days ago, 3 settled
  { dayOffset: 3, status: 'settled', callCount: 5, latencies: [160, 180, 170, 190, 175] },
  { dayOffset: 3, status: 'settled', callCount: 3, latencies: [200, 210, 185] },
  { dayOffset: 3, status: 'settled', callCount: 2, latencies: [190, 205] },
  // 2 days ago, 2 settled 1 refunded
  { dayOffset: 2, status: 'settled', callCount: 3, latencies: [220, 240, 230] },
  { dayOffset: 2, status: 'refunded', callCount: 2, latencies: [3800, 5200] },
  { dayOffset: 2, status: 'settled', callCount: 4, latencies: [180, 200, 190, 210] },
  // 1 day ago, 3 settled
  { dayOffset: 1, status: 'settled', callCount: 2, latencies: [170, 195] },
  { dayOffset: 1, status: 'settled', callCount: 5, latencies: [165, 185, 175, 190, 180] },
  { dayOffset: 1, status: 'settled', callCount: 3, latencies: [200, 220, 205] },
  // today, 2 settled
  { dayOffset: 0, status: 'settled', callCount: 4, latencies: [175, 185, 195, 180] },
  { dayOffset: 0, status: 'settled', callCount: 3, latencies: [190, 200, 210] },
];

const basUids = [
  '0x8f3e4c9b1d2a5f7e6b4c8d9e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
  '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  '0x9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d',
  '0x2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e',
  '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  '0x5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e',
  '0xb3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4',
  '0x6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f',
];

let uidIdx = 0;
for (const s of sessions) {
  const settledAt = new Date(now - s.dayOffset * DAY + Math.random() * DAY * 0.4);
  const openedAt = new Date(settledAt.getTime() - 30_000);
  const expiresAt = new Date(openedAt.getTime() + 24 * DAY);

  const pricePerCall = 0.1;
  const budgetTotal = pricePerCall * 10;
  const spent = pricePerCall * s.callCount;

  const session = await p.session.create({
    data: {
      skillId: ECHO_ID,
      payerAgentId: agent.id,
      status: s.status,
      callCount: s.callCount,
      openedAt,
      settledAt,
      expiresAt,
      basAttestationUid: basUids[uidIdx++ % basUids.length],
      budgetTotal,
      budgetRemaining: Math.max(0, budgetTotal - spent),
      pricePerCall,
    },
  });

  let nonce = 0;
  for (const latency of s.latencies) {
    const pass = latency < 3000 && s.status === 'settled';
    await p.skillCall.create({
      data: {
        sessionId: session.id,
        nonce: nonce++,
        requestHash: '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join(''),
        status: pass ? 'success' : 'gateway_error',
        httpStatus: pass ? 200 : 500,
        latencyMs: latency,
        costUsdc: pricePerCall,
        delivered: pass,
        validFormat: pass,
        withinSla: latency < 5000,
        score: pass ? 1 : 0,
        createdAt: new Date(openedAt.getTime() + nonce * 1000),
      },
    });
  }
}

// Update skill evaluation score
const settledCount = sessions.filter((s) => s.status === 'settled').length;
const totalCount = sessions.length;
const trustScore = Math.round((settledCount / totalCount) * 100);
await p.skill.update({
  where: { id: ECHO_ID },
  data: { evaluationScore: trustScore },
});

console.log(`Seeded ${sessions.length} sessions for Echo Test`);
console.log(`  Settled: ${settledCount}, Refunded: ${totalCount - settledCount}`);
console.log(`  Trust score: ${trustScore}`);
console.log(`  KYA tokenId: 42 (verified)`);

await p.$disconnect();
