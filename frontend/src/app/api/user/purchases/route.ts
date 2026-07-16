import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPrivyAuth } from "@/lib/privy-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/purchases
 *
 * Returns all skills purchased by the authenticated user.
 * Requires Privy JWT in Authorization header.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify JWT auth
    const authHeader = req.headers.get("authorization");
    const authResult = await verifyPrivyAuth(authHeader);

    if (!authResult.success || !authResult.privyId) {
      return NextResponse.json(
        { error: authResult.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    // Find user by privyId
    const user = await prisma.user.findUnique({
      where: { privyId: authResult.privyId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch all completed purchases with skill data
    const purchases = await prisma.purchase.findMany({
      where: {
        userId: user.id,
        status: "completed",
      },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            icon: true,
            price: true,
            rating: true,
            installs: true,
            imageUrl: true,
            creator: {
              select: {
                displayName: true,
                walletAddress: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to skill-centric response
    const skills = purchases.map((p) => ({
      id: p.skill.id,
      name: p.skill.name,
      description: p.skill.description,
      category: p.skill.category,
      icon: p.skill.icon,
      price: p.skill.price,
      rating: p.skill.rating,
      installs: p.skill.installs,
      imageUrl: p.skill.imageUrl,
      creator: p.skill.creator,
      purchasedAt: p.createdAt,
      purchaseId: p.id,
    }));

    return NextResponse.json({
      skills,
      count: skills.length,
    });
  } catch (err: unknown) {
    console.error("[GET /api/user/purchases]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
