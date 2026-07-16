import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { createBscPublicClient, createBscWalletClient, getBscConfig, withRelayerLock } from '@/lib/erc8004';
import { getContracts } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const FAUCET_AMOUNT = 100; // 100 USDC per request
const FAUCET_AMOUNT_WEI = BigInt(FAUCET_AMOUNT) * BigInt(1e18); // 18 decimals on BSC

// Simple in-memory rate limit: max 1 request per wallet per hour
const rateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

const ERC20_TRANSFER_ABI = [
  {
    type: 'function', name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * POST /api/faucet/usdc
 *
 * Testnet only. Relayer transfers MockUSDC to the agent's wallet.
 * Rate limited to 1 request per wallet per hour.
 *
 * Body: { privyId, walletAddress }
 */
export async function POST(req: NextRequest) {
  try {
    const bscConfig = getBscConfig();
    if (!bscConfig.isTestnet) {
      return NextResponse.json(
        { error: 'Faucet is testnet only' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { privyId, walletAddress } = body;

    if (!privyId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: privyId, walletAddress' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Auth
    const skipAuth =
      process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (!skipAuth) {
      const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
      if (!authResult.success || authResult.privyId !== privyId) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        );
      }
    }

    // Verify wallet belongs to authenticated user
    const user = await prisma.user.findUnique({ where: { privyId } });
    if (!user?.walletAddress || user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Wallet not linked to your account' },
        { status: 403 }
      );
    }

    // Rate limit
    const key = walletAddress.toLowerCase();
    const lastRequest = rateLimit.get(key);
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const waitMinutes = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest)) / 60_000);
      return NextResponse.json(
        { error: `Rate limited — try again in ${waitMinutes} minutes` },
        { status: 429 }
      );
    }

    const contracts = getContracts();

    // Transfer USDC from relayer to wallet
    const result = await withRelayerLock(async () => {
      const wallet = createBscWalletClient();
      const client = createBscPublicClient();

      // Check relayer USDC balance first
      const relayerBalance = await client.readContract({
        address: contracts.usdc,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'balanceOf',
        args: [wallet.account.address],
      });

      if (relayerBalance < FAUCET_AMOUNT_WEI) {
        return { success: false, error: 'Relayer USDC balance too low' };
      }

      const txHash = await wallet.writeContract({
        address: contracts.usdc,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [walletAddress as `0x${string}`, FAUCET_AMOUNT_WEI],
      });

      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 15_000,
      });

      if (receipt.status !== 'success') {
        return { success: false, error: 'Transfer reverted' };
      }

      return { success: true, txHash };
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Transfer failed' },
        { status: 500 }
      );
    }

    rateLimit.set(key, Date.now());

    console.log('[faucet/usdc] sent:', {
      to: walletAddress,
      amount: FAUCET_AMOUNT,
      txHash: result.txHash,
    });

    return NextResponse.json({
      amount: FAUCET_AMOUNT,
      txHash: result.txHash,
    });
  } catch (err: unknown) {
    console.error('[POST /api/faucet/usdc]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
