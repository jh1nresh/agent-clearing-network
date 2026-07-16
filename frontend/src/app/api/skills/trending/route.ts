import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/skills/trending
 *
 * Top skills by raw session volume over the last N days. "Trending" =
 * motion-over-time, distinct from `sort=trust` which is cumulative quality.
 *
 * Query params:
 *   limit?: number  (default 5, max 50)
 *   days?: number   (default 7, max 30)
 *
 * Response: `{ skills: Array<SkillSummary & { recentSessions, recentCalls }> }`
 *
 * Implementation:
 *   1. groupBy sessions opened in window → sum(callCount), count(sessions)
 *   2. fetch those skills in one round-trip, preserving groupBy order
 *   3. zero-state: if the window is empty, fall back to freshest listings
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (landing hero §Leaderboard+Trending)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 50);
  const days = Math.min(parseInt(searchParams.get("days") ?? "7"), 30);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const grouped = await prisma.session.groupBy({
    by: ["skillId"],
    where: { openedAt: { gte: since } },
    _sum: { callCount: true },
    _count: { _all: true },
    orderBy: { _count: { skillId: "desc" } },
    take: limit,
  });

  // Zero-state: no sessions in window → fall back to newest listings so the
  // landing surface is never empty on a fresh seed.
  if (grouped.length === 0) {
    const fallback = await prisma.skill.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    return NextResponse.json({
      window: { days, since: since.toISOString() },
      zeroState: true,
      skills: fallback.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        pricePerCall: s.pricePerCall,
        gatewaySlug: s.gatewaySlug,
        trustScore: s.evaluationScore ?? 0,
        callCount: 0,
        recentSessions: 0,
        recentCalls: 0,
      })),
    });
  }

  const ids = grouped.map((g) => g.skillId);
  const rows = await prisma.skill.findMany({
    where: { id: { in: ids } },
    include: {
      creator: { select: { id: true, displayName: true, avatarUrl: true } },
      _count: { select: { sessions: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const skills = grouped
    .map((g) => {
      const s = byId.get(g.skillId);
      if (!s) return null;
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        pricePerCall: s.pricePerCall,
        gatewaySlug: s.gatewaySlug,
        trustScore: s.evaluationScore ?? 0,
        callCount: s._count.sessions,
        recentSessions: g._count._all,
        recentCalls: g._sum.callCount ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({
    window: { days, since: since.toISOString() },
    zeroState: false,
    skills,
  });
}
