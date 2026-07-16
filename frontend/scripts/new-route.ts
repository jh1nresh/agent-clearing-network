#!/usr/bin/env tsx
/**
 * new-route.ts — Generate a new API route with standard auth pattern.
 *
 * Usage:
 *   npx tsx scripts/new-route.ts skills/[id]/reviews GET
 *   npx tsx scripts/new-route.ts sessions POST
 *   npx tsx scripts/new-route.ts agents/[id]/stats GET POST
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/new-route.ts <path> <METHOD...>');
  console.error('  e.g. npx tsx scripts/new-route.ts skills/[id]/reviews GET');
  process.exit(1);
}

const routePath = args[0];
const methods = args.slice(1).map((m) => m.toUpperCase());

const dir = join(process.cwd(), 'src', 'app', 'api', routePath);
const filePath = join(dir, 'route.ts');

if (existsSync(filePath)) {
  console.error(`ERROR: ${filePath} already exists`);
  process.exit(1);
}

// Extract dynamic params from path (e.g., [id] → id)
const paramMatches = routePath.match(/\[(\w+)\]/g) || [];
const params = paramMatches.map((p) => p.replace(/[[\]]/g, ''));
const paramsType = params.length > 0
  ? `{ params }: { params: { ${params.map((p) => `${p}: string`).join('; ')} } }`
  : '';

function generateHandler(method: string): string {
  const reqType = method === 'GET' ? 'NextRequest' : 'NextRequest';
  const reqParam = method === 'GET' ? 'req' : 'req';
  const paramSig = paramsType ? `, ${paramsType}` : '';

  if (method === 'GET') {
    return `
export async function GET(${reqParam}: ${reqType}${paramSig}) {
  const { searchParams } = new URL(req.url);

  // TODO: implement
  return NextResponse.json({ message: 'ok' });
}`;
  }

  return `
export async function ${method}(${reqParam}: ${reqType}${paramSig}) {
  const body = await req.json();

  // Auth — resolve userId from JWT
  const skipAuth =
    process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production';

  let userId: string;

  if (skipAuth) {
    if (!body.userId) {
      return NextResponse.json({ error: 'userId required in dev mode' }, { status: 400 });
    }
    userId = body.userId;
  } else {
    const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { privyId: authResult.privyId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    userId = user.id;
  }

  // TODO: implement
  return NextResponse.json({ message: 'ok' }, { status: 201 });
}`;
}

const needsAuth = methods.some((m) => m !== 'GET');

const imports = [
  `import { NextRequest, NextResponse } from 'next/server';`,
  `import { prisma } from '@/lib/prisma';`,
];
if (needsAuth) {
  imports.push(`import { verifyPrivyAuth } from '@/lib/privy-server';`);
}

const content = `${imports.join('\n')}

export const dynamic = 'force-dynamic';
${methods.map(generateHandler).join('\n')}
`;

mkdirSync(dir, { recursive: true });
writeFileSync(filePath, content.trimStart() + '\n');
console.log(`✅ Created ${filePath}`);
console.log(`   Methods: ${methods.join(', ')}`);
if (needsAuth) {
  console.log('   Auth: verifyPrivyAuth + DOJO_SKIP_PRIVY_AUTH pattern included');
}
