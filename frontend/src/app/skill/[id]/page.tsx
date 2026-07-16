import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import SkillPageClient from './SkillPageClient';

export const dynamic = 'force-dynamic';

const SPARKLINE_WINDOW = 20; // last N settled/refunded sessions
const HEATMAP_DAYS = 7;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export default async function SkillPage({ params }: { params: { id: string } }) {
  const skill = await prisma.skill.findUnique({
    where: { id: params.id },
    include: {
      creator: true,
      sessions: {
        where: { status: { in: ['settled', 'refunded'] } },
        orderBy: { settledAt: 'asc' },
        select: {
          id: true,
          status: true,
          callCount: true,
          settledAt: true,
          basAttestationUid: true,
          calls: {
            select: {
              latencyMs: true,
              delivered: true,
              validFormat: true,
              withinSla: true,
            },
          },
        },
      },
    },
  });

  if (!skill) notFound();

  const totalCalls = skill.sessions.reduce((sum, s) => sum + s.callCount, 0);
  const totalSessions = skill.sessions.length;
  const passedSessions = skill.sessions.filter((s) => s.status === 'settled').length;
  const failedSessions = skill.sessions.filter((s) => s.status === 'refunded').length;
  const passRate = totalSessions > 0 ? Math.round((passedSessions / totalSessions) * 100) : 0;

  // Trust sparkline: running pass rate over last N sessions (chronological)
  const recentSessions = skill.sessions.slice(-SPARKLINE_WINDOW);
  const sparkline: number[] = [];
  let runningPass = 0;
  recentSessions.forEach((s, i) => {
    if (s.status === 'settled') runningPass += 1;
    sparkline.push(Math.round((runningPass / (i + 1)) * 100));
  });

  // Median latency across all calls for this skill
  const latencies = skill.sessions
    .flatMap((s) => s.calls)
    .map((c) => c.latencyMs)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 0);
  const medianLatencyMs = median(latencies);

  // 7-day heatmap: sessions per day, aligned to today (index 0 = 6 days ago, 6 = today)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const heatmap: { date: string; count: number }[] = [];
  for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const dayKey = day.toISOString().slice(0, 10);
    const count = skill.sessions.filter((s) => {
      if (!s.settledAt) return false;
      return s.settledAt.toISOString().slice(0, 10) === dayKey;
    }).length;
    heatmap.push({ date: dayKey, count });
  }

  // Reviews (public, newest first)
  const reviews = await prisma.review.findMany({
    where: { skillId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, displayName: true, walletAddress: true } },
      session: {
        select: {
          id: true,
          callCount: true,
          status: true,
          settledAt: true,
        },
      },
    },
  });

  // BAS attestations (most recent first, with uid)
  const attestations = skill.sessions
    .filter((s) => !!s.basAttestationUid)
    .slice()
    .reverse()
    .slice(0, 6)
    .map((s) => ({
      sessionId: s.id,
      status: s.status as 'settled' | 'refunded',
      uid: s.basAttestationUid as string,
      settledAt: s.settledAt ? s.settledAt.toISOString() : null,
    }));

  return (
    <SkillPageClient
      skill={{
        id: skill.id,
        name: skill.name,
        description: skill.description,
        longDescription: skill.longDescription,
        category: skill.category,
        pricePerCall: skill.pricePerCall,
        price: skill.price,
        skillType: skill.skillType,
        gatewaySlug: skill.gatewaySlug,
        fileContent: skill.fileContent,
        evaluationScore: skill.evaluationScore,
        createdAt: skill.createdAt.toISOString(),
        updatedAt: skill.updatedAt.toISOString(),
        creator: {
          id: skill.creator.id,
          displayName: skill.creator.displayName,
          walletAddress: skill.creator.walletAddress,
          erc8004TokenId: skill.creator.erc8004TokenId
            ? skill.creator.erc8004TokenId.toString()
            : null,
        },
      }}
      totalCalls={totalCalls}
      totalSessions={totalSessions}
      passRate={passRate}
      passedSessions={passedSessions}
      failedSessions={failedSessions}
      sparkline={sparkline}
      medianLatencyMs={medianLatencyMs}
      heatmap={heatmap}
      attestations={attestations}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
        session: r.session
          ? {
              id: r.session.id,
              callCount: r.session.callCount,
              status: r.session.status,
              settledAt: r.session.settledAt?.toISOString() ?? null,
            }
          : null,
      }))}
    />
  );
}
