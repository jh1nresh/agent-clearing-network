import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/users/sync
 * Upsert user from Privy identity — called on login
 *
 * Body: {
 *   privyId: string;        // from Privy session
 *   email?: string;
 *   walletAddress?: string;
 *   displayName?: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, email, walletAddress, displayName } = body;

    if (!privyId) {
      return NextResponse.json(
        { error: "Missing required field: privyId" },
        { status: 400 }
      );
    }

    // Upsert user from Privy identity
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {
        ...(email && { email }),
        ...(walletAddress && { walletAddress }),
        ...(displayName && { displayName }),
      },
      create: {
        privyId,
        email: email ?? null,
        walletAddress: walletAddress ?? null,
        displayName: displayName ?? null,
      },
    });

    return NextResponse.json(user, { status: 200 });
  } catch (err: unknown) {
    console.error("[POST /api/users/sync]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
