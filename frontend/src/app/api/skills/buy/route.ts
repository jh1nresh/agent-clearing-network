import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createPurchaseAttestation,
  generatePlaceholderAttestationUid,
} from "@/lib/eas"; // TODO: migrate to bas.ts when purchase attestation schema is on BAS

export const dynamic = "force-dynamic";

/**
 * POST /api/skills/buy
 * Purchase a skill and (optionally) equip it to an agent.
 * Handles both fiat (Stripe) and crypto (tx hash).
 *
 * Body: {
 *   privyId: string;       // buyer identity
 *   skillId: string;
 *   agentId?: string;      // if provided, auto-equip after purchase
 *   paymentMethod: "stripe" | "crypto" | "free";
 *   stripePaymentIntentId?: string;
 *   txHash?: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, skillId, agentId, paymentMethod, stripePaymentIntentId, txHash } = body;

    if (!privyId || !skillId || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields: privyId, skillId, paymentMethod" },
        { status: 400 }
      );
    }

    // Resolve user
    const user = await prisma.user.findUnique({ where: { privyId } });
    if (!user) {
      return NextResponse.json({ error: "User not found — create account first" }, { status: 404 });
    }

    // Resolve skill
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    // Check for duplicate purchase
    const existing = await prisma.purchase.findFirst({
      where: { userId: user.id, skillId, status: "completed" },
    });
    if (existing) {
      return NextResponse.json({ error: "Skill already purchased", purchase: existing }, { status: 409 });
    }

    // Validate payment (stub — integrate Stripe webhook / on-chain in Phase 2)
    if (paymentMethod === "stripe" && !stripePaymentIntentId) {
      return NextResponse.json({ error: "stripePaymentIntentId required for stripe payment" }, { status: 400 });
    }
    if (paymentMethod === "crypto" && !txHash) {
      return NextResponse.json({ error: "txHash required for crypto payment" }, { status: 400 });
    }
    // SECURITY: For crypto payments, mark as "pending_verification" until
    // we can verify the tx on-chain. The BuySkillButton frontend handles
    // the actual on-chain purchase via SkillNFT.buySkill() — this API
    // should be called AFTER the tx confirms, and we verify the receipt.
    // TODO: Add on-chain verification via publicClient.getTransactionReceipt()
    // to confirm: (1) tx exists, (2) SkillPurchased event emitted,
    // (3) buyer matches, (4) skillId matches.
    const cryptoStatus = paymentMethod === "crypto" ? "pending_verification" : "completed";
    // Phase 1: no Stripe — all passive skills downloadable for free
    // Phase 2: restore price guard when payment processing is integrated

    // Generate EAS attestation data (placeholder until on-chain registration)
    let attestationUid: string | undefined;
    const buyerAddress = user.walletAddress as `0x${string}` | null;
    const creatorAddress = (await prisma.user.findUnique({
      where: { id: skill.creatorId },
      select: { walletAddress: true },
    }))?.walletAddress as `0x${string}` | null;

    if (buyerAddress && creatorAddress && skill.onChainId !== null) {
      // Prepare attestation data for future on-chain submission
      const attestation = createPurchaseAttestation(
        buyerAddress,
        creatorAddress,
        BigInt(skill.onChainId),
        BigInt(Math.floor(skill.price * 1e6)) // Convert to USDC decimals
      );
      // Store placeholder UID - will be replaced when on-chain attestation is created
      attestationUid = generatePlaceholderAttestationUid(
        buyerAddress,
        skillId,
        Date.now()
      );
      // Log attestation data for debugging
      console.log("[EAS] Attestation prepared:", {
        schemaUid: attestation.schemaUid,
        encodedDataLength: attestation.encodedData.length,
        placeholderUid: attestationUid,
      });
    }

    // Record purchase — crypto purchases start as pending_verification
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        skillId,
        amount: skill.price,
        currency: skill.currency,
        status: paymentMethod === "free" ? "completed" : cryptoStatus,
        ...(txHash && { txHash }),
        ...(stripePaymentIntentId && { stripeId: stripePaymentIntentId }),
        ...(attestationUid && { attestationUid }),
      },
    });

    // Increment install counter
    await prisma.skill.update({
      where: { id: skillId },
      data: { installs: { increment: 1 } },
    });

    // Auto-equip to agent if provided
    let equipment = null;
    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: agentId, ownerId: user.id },
      });
      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found or not owned by user", purchase },
          { status: 404 }
        );
      }

      equipment = await prisma.agentSkill.upsert({
        where: { agentId_skillId: { agentId, skillId } },
        update: {},
        create: { agentId, skillId },
      });
    }

    return NextResponse.json(
      {
        purchase,
        equipment,
        skill: { id: skill.id, name: skill.name },
        attestation: attestationUid ? { uid: attestationUid, status: "pending" } : null,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[POST /api/skills/buy]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
