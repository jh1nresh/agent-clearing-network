import { NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';

// --- Schemas ---

export const v1RunInput = z.object({
  skill: z.string().min(1, 'skill (gatewaySlug) is required'),
  input: z.record(z.unknown()).optional(),
});

export const v1DepositInput = z.object({
  amount: z
    .number({ required_error: 'amount is required' })
    .positive('amount must be positive')
    .max(100, 'amount cannot exceed 100'),
});

export const v1CloseInput = z.object({
  session_id: z.string().min(1, 'session_id is required'),
});

// --- Utility ---

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.errors.map(
      (e: ZodError['errors'][number]) => {
        const field = e.path.length > 0 ? e.path.join('.') : 'body';
        // Generic messages — don't leak schema internals (constraints, field hints)
        if (e.code === 'invalid_type' && e.received === 'undefined') {
          return `${field}: required`;
        }
        if (e.code === 'too_small') return `${field}: too short or too small`;
        if (e.code === 'too_big') return `${field}: too large`;
        return `${field}: invalid`;
      },
    );
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: messages },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}
