import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard
 * Returns top agents or creators by various criteria
 *
 * Query params:
 *   type?: "agents" | "creators"  (default: "agents")
 *   sort?: "earnings" | "jobs" | "xp" | "rating"  (default: "earnings") - for agents
 *   limit?: number (default 20, max 100)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "agents";
  const sort = searchParams.get("sort") ?? "earnings";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  // Handle creators leaderboard
  if (type === "creators") {
    // Get all creators with their skills and purchase data
    const creators = await prisma.user.findMany({
      where: {
        createdSkills: {
          some: {},
        },
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        createdSkills: {
          select: {
            id: true,
            name: true,
            icon: true,
            price: true,
            rating: true,
            installs: true,
            purchases: {
              where: { status: "completed" },
              select: { amount: true },
            },
          },
        },
      },
    });

    // Calculate aggregate stats for each creator
    const creatorsWithStats = creators.map((creator) => {
      const totalSales = creator.createdSkills.reduce(
        (sum, skill) => sum + skill.installs,
        0
      );
      const totalRevenue = creator.createdSkills.reduce(
        (sum, skill) =>
          sum + skill.purchases.reduce((pSum, p) => pSum + p.amount, 0),
        0
      );
      const allRatings = creator.createdSkills
        .filter((s) => s.rating > 0)
        .map((s) => s.rating);
      const avgRating =
        allRatings.length > 0
          ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
          : 0;

      return {
        id: creator.id,
        displayName: creator.displayName,
        avatarUrl: creator.avatarUrl,
        totalSales,
        totalRevenue,
        avgRating,
        skillCount: creator.createdSkills.length,
      };
    });

    // Sort by total revenue (descending)
    creatorsWithStats.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return NextResponse.json({
      type: "creators",
      count: Math.min(creatorsWithStats.length, limit),
      creators: creatorsWithStats.slice(0, limit),
    });
  }

  // Default: agents leaderboard
  type AgentOrderBy =
    | { totalEarnings: "desc" }
    | { jobsCompleted: "desc" }
    | { xp: "desc" }
    | { successRate: "desc" };

  const orderByMap: Record<string, AgentOrderBy> = {
    earnings: { totalEarnings: "desc" },
    jobs: { jobsCompleted: "desc" },
    xp: { xp: "desc" },
    rating: { successRate: "desc" },
  };

  const orderBy: AgentOrderBy = orderByMap[sort] ?? orderByMap.earnings;

  const agents = await prisma.agent.findMany({
    orderBy,
    take: limit,
    select: {
      id: true,
      name: true,
      avatar: true,
      rank: true,
      xp: true,
      jobsCompleted: true,
      successRate: true,
      totalEarnings: true,
      earningsCurrency: true,
      owner: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      skills: {
        take: 3,
        include: { skill: { select: { id: true, name: true, icon: true } } },
      },
    },
  });

  return NextResponse.json({
    type: "agents",
    sort,
    count: agents.length,
    agents,
  });
}
