import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: { skills: { include: { skill: true } } },
    orderBy: { jobsCompleted: "desc" },
  });
  return NextResponse.json(agents);
}
