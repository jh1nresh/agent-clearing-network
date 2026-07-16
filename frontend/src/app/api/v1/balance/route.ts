import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/balance
 *
 * Check remaining credits for the authenticated API key.
 * Auth: Bearer API key.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization: Bearer <api_key>' },
      { status: 401 },
    );
  }
  const apiKey = auth.slice(7).trim();

  const user = await prisma.user.findUnique({
    where: { apiKey },
    select: {
      creditBalance: true,
      displayName: true,
      ownedAgents: {
        select: { id: true, name: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  return NextResponse.json({
    balance: user.creditBalance,
    display_name: user.displayName,
    agent: user.ownedAgents[0] ?? null,
  });
}
