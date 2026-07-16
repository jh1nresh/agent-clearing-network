import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/create
 * Create a new agent + upsert user from Privy
 *
 * Body: {
 *   privyId: string;        // from Privy session
 *   email?: string;
 *   walletAddress?: string;
 *   displayName?: string;
 *   avatarUrl?: string;
 *   agent: {
 *     name: string;
 *     description: string;
 *     avatar?: string;      // emoji or image URL
 *     skillIds?: string[];  // pre-selected skills to equip
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, email, walletAddress, displayName, avatarUrl, agent } = body;

    if (!privyId || !agent?.name || !agent?.description) {
      return NextResponse.json(
        { error: "Missing required fields: privyId, agent.name, agent.description" },
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
        ...(avatarUrl && { avatarUrl }),
      },
      create: {
        privyId,
        email: email ?? null,
        walletAddress: walletAddress ?? null,
        displayName: displayName ?? null,
        avatarUrl: avatarUrl ?? null,
      },
    });

    // Create the agent
    const newAgent = await prisma.agent.create({
      data: {
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar ?? "🤖",
        ownerId: user.id,
      },
    });

    // Equip pre-selected skills (if any)
    if (agent.skillIds?.length) {
      const validSkills = await prisma.skill.findMany({
        where: { id: { in: agent.skillIds } },
        select: { id: true },
      });

      if (validSkills.length > 0) {
        for (const s of validSkills) {
          await prisma.agentSkill.upsert({
            where: { agentId_skillId: { agentId: newAgent.id, skillId: s.id } },
            update: {},
            create: { agentId: newAgent.id, skillId: s.id },
          });
        }
      }
    }

    // Return agent with equipped skills
    const result = await prisma.agent.findUnique({
      where: { id: newAgent.id },
      include: {
        skills: { include: { skill: true } },
        owner: true,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/agents/create]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
