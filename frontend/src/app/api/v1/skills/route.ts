import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function safeJsonParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * GET /api/v1/skills
 *
 * List all active (pay-per-use) skills available for calling via /api/v1/run.
 * No auth required — this is a public catalog.
 */
export async function GET() {
  const skills = await prisma.skill.findMany({
    where: {
      skillType: 'active',
      endpointUrl: { not: null },
      gatewaySlug: { not: null },
    },
    select: {
      name: true,
      description: true,
      gatewaySlug: true,
      pricePerCall: true,
      category: true,
      tags: true,
      icon: true,
      estLatencyMs: true,
      inputShape: true,
      outputShape: true,
      exampleInput: true,
      exampleOutput: true,
    },
    orderBy: { name: 'asc' },
  });

  const result = skills.map((s) => ({
    skill: s.gatewaySlug,
    name: s.name,
    description: s.description,
    price_per_call: s.pricePerCall ?? 0,
    category: s.category,
    tags: s.tags ? s.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    icon: s.icon,
    latency_ms: s.estLatencyMs,
    input_shape: s.inputShape,
    output_shape: s.outputShape,
    example_input: safeJsonParse(s.exampleInput),
    example_output: safeJsonParse(s.exampleOutput),
  }));

  return NextResponse.json({ skills: result, count: result.length });
}
