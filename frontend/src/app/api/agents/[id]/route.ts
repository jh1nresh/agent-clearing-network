import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      skills: { include: { skill: true } },
      reviews: { include: { user: true }, orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 10 },
      owner: true,
    },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}
