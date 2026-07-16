'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Calendar, Network, ShieldCheck, Tag, Wallet, Zap } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';
import TrustCard from '@/components/TrustCard';
import SkillSandbox from '@/components/SkillSandbox';
import ReviewSection from '@/components/ReviewSection';
import ReviewForm from '@/components/ReviewForm';

const PurchaseCard = dynamic(() => import('@/components/PurchaseCard'), { ssr: false });

interface SkillData {
  id: string;
  name: string;
  description: string | null;
  longDescription: string | null;
  category: string | null;
  pricePerCall: number | null;
  price: number;
  skillType: string;
  gatewaySlug: string | null;
  fileContent: string | null;
  evaluationScore: number | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
    erc8004TokenId: string | null;
  };
}

interface Attestation {
  sessionId: string;
  status: 'settled' | 'refunded';
  uid: string;
  settledAt: string | null;
}

interface HeatmapBucket {
  date: string;
  count: number;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
  };
  session: {
    id: string;
    callCount: number;
    status: string;
    settledAt: string | null;
  } | null;
}

interface SettledSession {
  id: string;
  callCount: number;
  status: string;
  settledAt: string | null;
}

interface Props {
  skill: SkillData;
  totalCalls: number;
  totalSessions: number;
  passRate: number;
  passedSessions: number;
  failedSessions: number;
  sparkline: number[];
  medianLatencyMs: number | null;
  heatmap: HeatmapBucket[];
  attestations: Attestation[];
  reviews: ReviewData[];
}

function truncateAddress(address: string | null | undefined): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export default function SkillPageClient({
  skill,
  totalCalls,
  totalSessions,
  passedSessions,
  failedSessions,
  sparkline,
  medianLatencyMs,
  heatmap,
  attestations,
  reviews,
}: Props) {
  const trustScore = skill.evaluationScore ?? 0;
  const { authenticated, user, getAccessToken } = usePrivy();
  const [userSessions, setUserSessions] = useState<SettledSession[]>([]);
  const [dbUserId, setDbUserId] = useState<string | undefined>();

  useEffect(() => {
    if (!authenticated || !user) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      // Fetch user's settled sessions for this skill
      const res = await fetch(
        `/api/sessions?privyId=${encodeURIComponent(user.id)}&skillId=${skill.id}&status=settled,refunded`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setUserSessions(data.sessions ?? []);
      setDbUserId(data.userId);
    })();
    return () => { cancelled = true; };
  }, [authenticated, user, getAccessToken, skill.id]);

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <BackgroundEffect />
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 transition-opacity hover:opacity-70 text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to marketplace
          </Link>

          {/* Header */}
          <header className="mb-12">
            {skill.category && (
              <span className="inline-block font-mono text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm text-[var(--text-muted)] mb-5">
                {skill.category}
              </span>
            )}
            <h1 className="text-[40px] md:text-[56px] font-bold tracking-tight leading-tight mb-5 text-[var(--text)]">
              {skill.name}
            </h1>
            <div className="flex items-center gap-2 text-[14px] text-[var(--text-muted)]">
              <span>by</span>
              <span className="text-[var(--text)]">
                {skill.creator.displayName || truncateAddress(skill.creator.walletAddress)}
              </span>
              <span>·</span>
              <span>Listed {formatDate(skill.createdAt)}</span>
            </div>
          </header>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            {[
              {
                label: 'Per call',
                value: skill.pricePerCall ? `$${skill.pricePerCall.toFixed(2)}` : 'FREE',
              },
              { label: 'Total calls', value: totalCalls.toLocaleString() },
              { label: 'Sessions', value: totalSessions.toLocaleString() },
              { label: 'Trust score', value: trustScore.toString() },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-5">
                <div className="font-mono text-2xl font-bold tabular-nums text-[var(--text)]">
                  {stat.value}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1 text-[var(--text-muted)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <section className="glass-card p-8">
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] mb-5 text-[var(--text-muted)]">
                  About this skill
                </div>
                <div className="text-base leading-relaxed space-y-4 text-[var(--text-secondary)]">
                  {(skill.longDescription || skill.description || 'No description provided.')
                    .split('\n\n')
                    .map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                </div>
              </section>

              {/* Flagship: live sandbox (token-price-oracle only) */}
              {skill.gatewaySlug === 'token-price-oracle' && (
                <SkillSandbox />
              )}

              {/* Flagship: trust dossier */}
              <TrustCard
                trustScore={trustScore}
                passedSessions={passedSessions}
                failedSessions={failedSessions}
                totalSessions={totalSessions}
                medianLatencyMs={medianLatencyMs}
                sparkline={sparkline}
                heatmap={heatmap}
                attestations={attestations}
                creator={{
                  displayName: skill.creator.displayName,
                  walletAddress: skill.creator.walletAddress,
                  erc8004TokenId: skill.creator.erc8004TokenId,
                }}
              />

              <ReviewSection reviews={reviews} />

              {authenticated && (
                <div className="glass-card p-8">
                  <ReviewForm
                    targetType="skill"
                    targetId={skill.id}
                    userId={dbUserId}
                    sessions={userSessions}
                  />
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <aside className="space-y-6">
              <PurchaseCard
                skill={{
                  id: skill.id,
                  name: skill.name,
                  skillType: skill.skillType,
                  price: skill.price,
                  pricePerCall: skill.pricePerCall,
                  gatewaySlug: skill.gatewaySlug,
                  fileContent: skill.fileContent,
                }}
              />

              <div className="glass-card p-7">
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] mb-5 text-[var(--text-muted)]">
                  Specification
                </div>
                <div className="space-y-3">
                  {[
                    { icon: Network, label: 'Network', value: 'BNB Smart Chain' },
                    { icon: ShieldCheck, label: 'Settlement', value: 'ERC-8183' },
                    { icon: Wallet, label: 'Payment', value: 'USDC per call' },
                    { icon: Tag, label: 'Category', value: skill.category || '—' },
                    { icon: Calendar, label: 'Listed', value: formatDate(skill.createdAt) },
                    { icon: Zap, label: 'Updated', value: formatDate(skill.updatedAt) },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        <Icon className="w-3 h-3" />
                        {label}
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-7">
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] mb-5 text-[var(--text-muted)]">
                  Creator
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{
                      backgroundColor: `hsl(${
                        ((skill.creator.id?.charCodeAt(0) ?? 0) * 37) % 360
                      }, 60%, 50%)`,
                    }}
                  >
                    {(skill.creator.displayName || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate text-[var(--text)]">
                      {skill.creator.displayName || 'Anonymous'}
                    </div>
                    <div className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                      {truncateAddress(skill.creator.walletAddress)}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
