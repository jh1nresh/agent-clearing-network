import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs
 * List jobs (filterable by agentId, status)
 *
 * Query params:
 *   agentId?: string
 *   status?: "open" | "in-progress" | "completed" | "rejected"
 *   limit?: number (default 20)
 *
 * POST /api/jobs
 * Submit a new job request to an agent
 *
 * Body: {
 *   privyId: string;       // requester identity
 *   agentId: string;       // which agent to hire
 *   title: string;
 *   description: string;
 *   payment?: number;
 *   currency?: "USD" | "USDC" | "ETH";
 * }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  const jobs = await prisma.job.findMany({
    where: {
      ...(agentId && { agentId }),
      ...(status && { status }),
    },
    include: {
      agent: { select: { id: true, name: true, avatar: true, rank: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { privyId, agentId, title, description, payment, currency } = body;

    if (!privyId || !agentId || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: privyId, agentId, title, description" },
        { status: 400 }
      );
    }

    // Resolve user
    const user = await prisma.user.findUnique({ where: { privyId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Resolve agent
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        agentId,
        title,
        description,
        status: "open",
        payment: payment ?? 0,
        currency: currency ?? "USD",
      },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
      },
    });

    // TODO Phase 3: trigger x402 payment + LLM execution stub here

    return NextResponse.json(job, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/jobs]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
