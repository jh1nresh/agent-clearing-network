'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, DollarSign, ShieldCheck, Star, TrendingUp } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';

interface SkillSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  price: number;
  rating: number;
  installs: number;
}

interface Props {
  creator: {
    id: string;
    displayName: string | null;
    walletAddress: string | null;
    memberSince: string;
    skills: SkillSummary[];
  };
  totalSales: number;
  avgRating: number;
  totalRevenue: number;
  refundRate: number;
}

function truncateAddress(address: string | null | undefined): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function CreatorPageClient({
  creator,
  totalSales,
  avgRating,
  totalRevenue,
  refundRate,
}: Props) {
  const glassCard = 'border border-[var(--border)] bg-[var(--card-bg)]';

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  } as const;

  const stats = [
    { label: 'Total sales', value: totalSales.toLocaleString(), icon: TrendingUp },
    { label: 'Avg rating', value: avgRating > 0 ? avgRating.toFixed(1) : '—', icon: Star },
    { label: 'Revenue', value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: 'Refund rate', value: `${refundRate.toFixed(1)}%`, icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
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
          <header className="flex items-start gap-6 mb-12">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 bg-[var(--bg-secondary)] text-[var(--text)]">
              {(creator.displayName || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="inline-block text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border mb-3 border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]">
                Creator profile
              </span>
              <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] mb-3 text-[var(--text)]">
                {creator.displayName || 'Anonymous'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                <span className="font-mono tabular-nums">
                  {truncateAddress(creator.walletAddress)}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Since {creator.memberSince}
                </span>
              </div>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`rounded-2xl p-5 border ${glassCard}`}
                  style={glassStyle}
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  <div className="font-mono text-2xl font-bold tabular-nums text-[var(--text)]">
                    {stat.value}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1 text-[var(--text-muted)]">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Skills section */}
          <section
            className={`rounded-3xl p-8 border ${glassCard}`}
            style={glassStyle}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Published skills
              </div>
              <div className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                {creator.skills.length}
              </div>
            </div>

            {creator.skills.length === 0 ? (
              <p className="text-sm italic text-[var(--text-muted)]">
                No skills published yet.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {creator.skills.map((skill, i) => (
                  <motion.div
                    key={skill.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.03 }}
                  >
                    <Link
                      href={`/skill/${skill.id}`}
                      className="group block rounded-2xl p-5 border transition-all hover:opacity-80 border-[var(--border-light)] bg-[var(--bg-secondary)]"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">{skill.icon || '⚡'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-sans font-semibold text-sm truncate text-[var(--text)]">
                            {skill.name}
                          </div>
                          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-0.5 text-[var(--text-muted)]">
                            {skill.category || 'Uncategorized'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-2 mb-4 text-[var(--text-secondary)]">
                        {skill.description || '—'}
                      </p>
                      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-light)]">
                        <div className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                          {skill.installs.toLocaleString()} installs
                        </div>
                        <div className="font-mono text-xs font-bold tabular-nums text-[var(--text)]">
                          {skill.price === 0 ? 'FREE' : `$${skill.price.toFixed(2)}`}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
