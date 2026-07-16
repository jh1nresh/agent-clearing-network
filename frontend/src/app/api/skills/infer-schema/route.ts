import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { inferInputSchema } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/infer-schema
 *
 * Accepts { name, description, inputDescription } and returns
 * an LLM-inferred JSON Schema + example input.
 *
 * Auth: Privy JWT (dev bypass with DOJO_SKIP_PRIVY_AUTH).
 */
export async function POST(req: NextRequest) {
  try {
    const skipAuth =
      process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (!skipAuth) {
      const auth = await verifyPrivyAuth(req.headers.get('Authorization'));
      if (!auth.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { name, description, inputDescription } = body;

    if (!name || !description || !inputDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, inputDescription' },
        { status: 400 }
      );
    }

    const result = await inferInputSchema(name, description, inputDescription);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/skills/infer-schema]', err);
    const message = err instanceof Error ? err.message : 'Schema inference failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
