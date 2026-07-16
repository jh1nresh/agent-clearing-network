import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseBody, v1DepositInput } from '@/lib/validators';
import { logInfo } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_PER_DEPOSIT = 100;   // $100 USDC cap per deposit
const MAX_TOTAL_BALANCE = 1000; // $1000 USDC cap per user

/**
 * POST /api/v1/deposit
 *
 * Testnet credit deposit. Increments user's creditBalance in DB.
 * No on-chain USDC transfer — agent developers don't need wallets in Phase 1.
 *
 * Auth: Bearer API key
 * Body: { amount: number }  // USDC amount (e.g. 10 = $10)
 *
 * Response 200: { balance: number, deposited: number }
 *
 * Guards:
 *   - Testnet only (BSC_RPC_URL must contain "testnet" or chain 97)
 *   - Max $100 per deposit
 *   - Max $1000 total balance
 */
export async function POST(req: NextRequest) {
  // --- Testnet guard ---
  const rpc = process.env.BSC_RPC_URL ?? '';
  const chainId = process.env.BSC_CHAIN_ID ?? '';
  const isTestnet = rpc.includes('testnet') || chainId === '97' || process.env.NODE_ENV !== 'production';

  if (!isTestnet) {
    return NextResponse.json(
      { error: 'Deposit endpoint is testnet-only. Use on-chain USDC transfer for mainnet.' },
      { status: 403 },
    );
  }

  // --- Auth: Bearer API key ---
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization: Bearer <api_key>' },
      { status: 401 },
    );
  }
  const apiKey = auth.slice(7).trim();

  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // --- Parse body ---
  const parsed = await parseBody(req, v1DepositInput);
  if (!parsed.success) return parsed.response;
  const { amount } = parsed.data;

  // --- Atomic balance cap + increment (prevents TOCTOU race) ---
  const updated = await prisma.user.updateMany({
    where: {
      id: user.id,
      creditBalance: { lte: MAX_TOTAL_BALANCE - amount },
    },
    data: { creditBalance: { increment: amount } },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      {
        error: `Total balance would exceed $${MAX_TOTAL_BALANCE} cap`,
        balance: user.creditBalance,
        max_deposit: Math.max(0, MAX_TOTAL_BALANCE - user.creditBalance),
      },
      { status: 400 },
    );
  }

  // Re-read for accurate balance in response
  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditBalance: true },
  });

  const newBalance = refreshed?.creditBalance ?? user.creditBalance + amount;

  logInfo('v1/deposit', 'credit deposited', {
    userId: user.id,
    amount,
    previousBalance: user.creditBalance,
    newBalance,
  });

  return NextResponse.json({
    balance: newBalance,
    deposited: amount,
  });
}
