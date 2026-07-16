import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateTrustScore } from '@/lib/trust-score';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/reputation?address=0x...
 *
 * Public trust score query for REST API consumers.
 * Wraps the same calculation as /api/trust/[address].
 *
 * No auth required — reputation is public by design.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json(
      { error: 'Query param `address` must be a valid 0x... wallet address' },
      { status: 400 },
    );
  }

  // SQLite is case-insensitive for ASCII, but check both forms for safety
  const agent = await prisma.agent.findFirst({
    where: {
      OR: [
        { walletAddress: address.toLowerCase() },
        { walletAddress: address },
      ],
    },
    include: {
      reviews: { select: { rating: true } },
      jobs: { where: { status: 'completed' }, select: { id: true } },
    },
  });

  if (!agent) {
    return NextResponse.json(
      { error: 'Agent not found for this address' },
      { status: 404 },
    );
  }

  // Average rating
  const ratings = agent.reviews.map((r: { rating: number }) => r.rating);
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

  // Attestation count
  const attestationCount = await prisma.purchase.count({
    where: {
      attestationUid: { not: null },
      skill: {
        creator: {
          ownedAgents: { some: { id: agent.id } },
        },
      },
    },
  });

  const { score: trustScore, breakdown } = calculateTrustScore({
    successRate: agent.successRate,
    avgRating,
    jobsCompleted: agent.jobsCompleted,
    attestationCount,
  });

  return NextResponse.json({
    address,
    trust_score: trustScore,
    success_rate: agent.successRate,
    avg_rating: Math.round(avgRating * 100) / 100,
    jobs_completed: agent.jobsCompleted,
    attestation_count: attestationCount,
    breakdown: {
      success_rate: { value: agent.successRate, weight: 0.4, points: breakdown.successRate },
      avg_rating: { value: Math.round(avgRating * 100) / 100, weight: 0.3, points: breakdown.rating },
      jobs_completed: { value: agent.jobsCompleted, cap: 100, weight: 0.2, points: breakdown.jobs },
      attestations: { value: attestationCount, cap: 50, weight: 0.1, points: breakdown.attestations },
    },
  });
}
