import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills-internal/price
 *
 * Mock token price oracle. Returns deterministic prices with slight randomness
 * to simulate a live feed. Used for E2E testing.
 */

const BASE_PRICES: Record<string, number> = {
  BNB: 312.45,
  ETH: 1845.20,
  BTC: 43250.00,
  USDC: 1.0,
  USDT: 1.0,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { token = 'BNB', chain = 'bsc', currency = 'usd' } = body as {
    token?: string;
    chain?: string;
    currency?: string;
  };

  const symbol = token.toUpperCase().replace(/^0X.*/, 'BNB'); // address → default BNB
  const basePrice = BASE_PRICES[symbol] ?? 1.0;

  // Add +/- 0.5% jitter for realism
  const jitter = 1 + (Math.random() - 0.5) * 0.01;
  const price = parseFloat((basePrice * jitter).toFixed(4));
  const change24h = parseFloat(((Math.random() - 0.5) * 0.06).toFixed(4)); // +/- 3%

  return NextResponse.json({
    token: symbol,
    chain,
    currency,
    price_usd: price,
    twap_1h: parseFloat((price * (1 - 0.001)).toFixed(4)),
    change_24h: change24h,
    source: 'mock-oracle',
    timestamp: new Date().toISOString(),
  });
}
