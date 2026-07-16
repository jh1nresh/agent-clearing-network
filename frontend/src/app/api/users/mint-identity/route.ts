import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPrivyAuth } from '@/lib/privy-server';
import { mintIdentityFor, getAgentIdOf } from '@/lib/erc8004';
import { checkRelayerBalance } from '@/lib/relayer';

export const dynamic = 'force-dynamic';

// Safety flag — set to 'true' in env to enable mints.
// Keeps mints dead until relayer is funded and ABI confirmed on target chain.
const KYA_MINT_ENABLED = process.env.ENABLE_KYA_MINT === 'true';

/**
 * POST /api/users/mint-identity
 * Mint an ERC-8004 agent identity for the authenticated user.
 *
 * Auth: Bearer <privy-jwt>
 * Body: { privyId: string }
 *
 * Four cases:
 *   existing  → 200 { status: "existing", tokenId, kyaLevel }
 *   pending   → 202 { status: "pending", retryAt }
 *   minted    → 201 { status: "minted", tokenId, txHash, kyaLevel }
 *   failed    → marks pendingMint=true, returns 202
 */
export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = await verifyPrivyAuth(req.headers.get('Authorization'));
  if (!auth.success || !auth.privyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { privyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { privyId } = body;
  if (!privyId) {
    return NextResponse.json({ error: 'Missing privyId' }, { status: 400 });
  }

  // Prevent a user from minting for a different Privy account
  if (privyId !== auth.privyId) {
    return NextResponse.json(
      { error: 'Unauthorized — privyId mismatch' },
      { status: 403 }
    );
  }

  // 2. Fetch user
  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json(
      { error: 'User not found — call /api/users/sync first' },
      { status: 404 }
    );
  }

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: 'User has no walletAddress — connect a wallet first' },
      { status: 400 }
    );
  }

  const wallet = user.walletAddress as `0x${string}`;

  // Feature flag — disabled until relayer funded + chain ABI confirmed (Spec B §12)
  if (!KYA_MINT_ENABLED) {
    return NextResponse.json(
      { status: 'disabled', error: 'KYA mint not yet enabled on this environment' },
      { status: 503 }
    );
  }

  // Case 1: already minted in DB
  if (user.erc8004TokenId != null) {
    return NextResponse.json(
      {
        status: 'existing',
        tokenId: user.erc8004TokenId.toString(),
        txHash: null,
        kyaLevel: user.kyaLevel,
      },
      { status: 200 }
    );
  }

  // Case 2: previous attempt failed, waiting for cron retry
  if (user.pendingMint) {
    const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // next cron ~10 min
    return NextResponse.json({ status: 'pending', retryAt }, { status: 202 });
  }

  // Case 3: defensive on-chain re-read — maybe wallet already registered
  const onChainId = await getAgentIdOf(wallet);
  if (onChainId > 0n) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        erc8004TokenId: onChainId,
        kyaLevel: 0,
        pendingMint: false,
      },
    });
    return NextResponse.json(
      {
        status: 'existing',
        tokenId: onChainId.toString(),
        txHash: null,
        kyaLevel: 0,
      },
      { status: 200 }
    );
  }

  // Case 4: fresh mint
  // Atomic claim — prevents duplicate mints from concurrent requests (e.g. two tabs).
  // Uses the same updateMany test-and-set pattern as sessions/close race guard.
  const claimResult = await prisma.user.updateMany({
    where: { id: user.id, pendingMint: false, erc8004TokenId: null },
    data: { pendingMint: true },
  });
  if (claimResult.count === 0) {
    // Race lost — another request is already processing this mint.
    const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return NextResponse.json({ status: 'pending', retryAt }, { status: 202 });
  }

  // 4a. Relayer balance guard
  const balance = await checkRelayerBalance();
  if (!balance.ok) {
    console.error('[mint-identity] Relayer low balance:', balance.balanceBnb, 'BNB');
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingMint: true },
    });
    return NextResponse.json(
      { error: 'Relayer wallet low balance — retry later' },
      { status: 503 }
    );
  }

  // 4b. Submit tx
  const result = await mintIdentityFor(wallet);

  if (result.success && result.agentId != null && result.agentId > 0n) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        erc8004TokenId: result.agentId,
        kyaLevel: 0,
        pendingMint: false,
      },
    });
    return NextResponse.json(
      {
        status: 'minted',
        tokenId: result.agentId.toString(),
        txHash: result.txHash ?? null,
        kyaLevel: 0,
      },
      { status: 201 }
    );
  }

  // 4c. Failed / timeout — set pendingMint for cron retry
  console.error('[mint-identity] Mint failed for', wallet, result.error);
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingMint: true },
  });
  const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  return NextResponse.json({ status: 'pending', retryAt }, { status: 202 });
}
