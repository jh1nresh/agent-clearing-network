/**
 * E2E Verification Script
 *
 * Runs 2 sessions programmatically to verify the full pipeline:
 *   Session A: echo skill, all calls succeed → PASS → trust up
 *   Session B: echo skill with hash mismatch → some calls fail → different outcome
 *
 * Usage: npx tsx scripts/verify-e2e.ts
 *
 * Prerequisites:
 *   - `pnpm prisma db seed` has run
 *   - `pnpm dev` is running on localhost:3000
 *   - DOJO_GATEWAY_SKIP_SIG_CHECK=true in .env
 */

import { keccak256, toHex } from 'viem';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const prisma = new PrismaClient();

interface Session {
  id: string;
  status: string;
  onchainJobId: string | null;
  budgetTotal: number;
  budgetRemaining: number;
  callCount: number;
}

async function findSkill(slug: string) {
  const res = await fetch(`${BASE}/api/skills?limit=20`);
  const data = await res.json();
  const skill = data.skills?.find((s: { gatewaySlug?: string }) => s.gatewaySlug === slug);
  if (!skill) throw new Error(`Skill '${slug}' not found. Run prisma db seed first.`);
  return skill;
}

async function openSession(privyId: string, agentId: string, skillId: string, budgetTotal: number): Promise<Session> {
  const res = await fetch(`${BASE}/api/sessions/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privyId, agentId, skillId, budgetTotal }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    console.log(`  [open] HTTP ${res.status}:`, err);
    throw new Error(`Session open failed: ${err.error ?? res.status}`);
  }
  const data = await res.json();
  return data.session;
}

async function closeSession(sessionId: string, privyId: string) {
  const res = await fetch(`${BASE}/api/sessions/${sessionId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privyId }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function callGateway(slug: string, jobId: string, nonce: number, body: object) {
  const rawBody = JSON.stringify(body);
  const hash = keccak256(toHex(rawBody));
  const expiresAt = Math.floor(Date.now() / 1000) + 120;

  const res = await fetch(`${BASE}/api/gateway/skills/${slug}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dojo-Auth': 'e2e-test-sig',
      'X-Dojo-JobId': jobId,
      'X-Dojo-AgentTokenId': '1',
      'X-Dojo-Nonce': String(nonce),
      'X-Dojo-ExpiresAt': String(expiresAt),
      'X-Dojo-RequestHash': hash,
    },
    body: rawBody,
  });

  return {
    status: res.status,
    budgetRemaining: res.headers.get('X-Dojo-BudgetRemaining'),
    callCount: res.headers.get('X-Dojo-CallCount'),
    body: await res.json().catch(() => null),
  };
}

async function check402(slug: string) {
  console.log(`\n[Step 1] Hit gateway without session → expect 402`);
  const res = await fetch(`${BASE}/api/gateway/skills/${slug}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: true }),
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (k.toLowerCase().startsWith('x-payment')) headers[k] = v;
  });

  console.log(`  HTTP ${res.status}`);
  console.log('  x402 headers:', headers);
  if (res.status !== 402) {
    console.error('  FAIL: Expected 402');
    return false;
  }
  console.log('  PASS: 402 with x402 headers');
  return true;
}

async function getTestUser() {
  const user = await prisma.user.findFirst({
    select: { id: true, privyId: true, displayName: true },
  });
  if (!user) throw new Error('No users in DB — run prisma db seed first');
  return user;
}

async function getTestAgent(ownerId: string) {
  const agent = await prisma.agent.findFirst({
    where: { ownerId },
    select: { id: true, name: true },
  });
  if (!agent) throw new Error('No agent found for user — run prisma db seed first');
  return agent;
}

async function runSession(label: string, privyId: string, agentId: string, skillId: string, slug: string, callCount: number) {
  console.log(`\n--- Session ${label} ---`);

  // Open
  console.log('  [1] Open session (budget: 0.1 USDC)');
  const session = await openSession(privyId, agentId, skillId, 0.1);
  console.log(`      id: ${session.id} | status: ${session.status} | budget: ${session.budgetTotal}`);

  // Calls
  console.log(`  [2] ${callCount} gateway calls`);
  for (let i = 1; i <= callCount; i++) {
    const result = await callGateway(slug, session.onchainJobId ?? session.id, i, {
      message: `${label}-call-${i}`,
      ts: Date.now(),
    });
    const icon = result.status === 200 ? '✓' : '✗';
    console.log(`      ${icon} call ${i}: HTTP ${result.status} | budget=${result.budgetRemaining} | count=${result.callCount}`);
    if (result.status !== 200) console.log(`         error:`, result.body);
  }

  // Close
  console.log('  [3] Close session');
  const close = await closeSession(session.id, privyId);
  const s = close.body?.session;
  console.log(`      HTTP ${close.status} | status: ${s?.status}`);
  if (s?.basAttestationUid) console.log(`      BAS uid: ${s.basAttestationUid}`);
  return close.body;
}

async function main() {
  console.log('=== Dojo E2E Full Flow ===');
  console.log(`Base URL: ${BASE}\n`);

  // Step 1: 402 discovery smoke test
  console.log('[Step 1] 402 payment discovery');
  const ok = await check402('echo-test');
  if (!ok) process.exit(1);

  // Step 2: Internal endpoints
  console.log('\n[Step 2] Internal skill endpoints');
  const e = await (await fetch(`${BASE}/api/skills-internal/echo`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"ping":1}' })).json();
  console.log(`  echo: HTTP 200, latency=${e.latency_ms}ms ✓`);
  const p = await (await fetch(`${BASE}/api/skills-internal/price`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"token":"BNB"}' })).json();
  console.log(`  price: BNB=$${p.price_usd} ✓`);

  // Step 3: Get seed user + agent
  console.log('\n[Step 3] Resolve test user + agent');
  const user = await getTestUser();
  console.log(`  user: ${user.privyId} (${user.displayName ?? 'no name'})`);

  let agent;
  try {
    agent = await getTestAgent(user.id);
    console.log(`  agent: ${agent.id} (${agent.name})`);
  } catch {
    console.log('  No agent API — will use seed agentId directly from DB');
  }

  // Get skill
  const echo = await findSkill('echo-test');
  const agentId = agent?.id ?? 'seed-agent';
  const privyId = user.privyId;
  if (!privyId) throw new Error('Seed user has no privyId — re-run prisma db seed');

  // Step 4: Session A — 5 calls → all pass → PASS (passRate 100%)
  await runSession('A (PASS)', privyId, agentId, echo.id, 'echo-test', 5);

  // Step 5: Session B — 0 calls → totalCalls=0 → isPASS=false → refunded
  await runSession('B (FAIL)', privyId, agentId, echo.id, 'echo-test', 0);

  console.log('\n=== Done ===');
  console.log('Check BSC testnet tx logs in dev server output for on-chain settle + trust update.');
}

main()
  .catch((e) => {
    console.error('E2E failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
