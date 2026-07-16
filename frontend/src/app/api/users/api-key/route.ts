import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/users/api-key
 *
 * Generate or retrieve the API key for the authenticated user.
 * Idempotent: returns existing key if already generated.
 *
 * Auth: Privy JWT in Authorization header + privyId in body (must match).
 *
 * Body: { privyId: string }
 * Response: { apiKey: string, created: boolean }
 */
export async function POST(req: NextRequest) {
  // --- Auth: verify Privy JWT and match privyId ---
  const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { privyId } = body as { privyId?: string };

  if (!privyId) {
    return NextResponse.json(
      { error: 'Missing required field: privyId' },
      { status: 400 },
    );
  }

  // Verify the authenticated user owns this privyId (prevents token hijacking)
  if (authResult.privyId !== privyId) {
    return NextResponse.json({ error: 'Unauthorized — privyId mismatch' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json(
      { error: 'User not found — sync account first via /api/users/sync' },
      { status: 404 },
    );
  }

  // Idempotent: return existing key if already generated
  if (user.apiKey) {
    return NextResponse.json({ apiKey: user.apiKey, created: false });
  }

  // Generate new key: dojo_sk_ + 32 random hex bytes
  const apiKey = `dojo_sk_${randomBytes(32).toString('hex')}`;

  await prisma.user.update({
    where: { id: user.id },
    data: { apiKey },
  });

  return NextResponse.json({ apiKey, created: true }, { status: 201 });
}
