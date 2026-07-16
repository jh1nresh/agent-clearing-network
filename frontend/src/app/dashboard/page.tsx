'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Activity, DollarSign, ShieldCheck } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';

interface SessionRow {
  id: string;
  status: string;
  budgetTotal: number;
  budgetRemaining: number;
  callCount: number;
  pricePerCall: number;
  settledAt: string | null;
  basAttestationUid: string | null;
  openedAt: string;
  agent?: { name: string; walletAddress: string | null; trustScore: number | null };
  skill?: { name: string; gatewaySlug: string | null };
}

interface DashboardData {
  user: {
    displayName: string | null;
    walletAddress: string;
    erc8004TokenId: string | null;
    kyaLevel: number;
  };
  role: 'creator' | 'agent';
  creator: {
    skillCount: number;
    totalEarnings: number;
    sessionCount: number;
    callCount: number;
    skills: { id: string; name: string; slug: string | null; pricePerCall: number | null; sessionCount: number }[];
    recentSessions: SessionRow[];
  };
  agent: {
    agents: { id: string; name: string; walletAddress: string | null; trustScore: number | null; sessionCount: number }[];
    totalSpent: number;
    sessionCount: number;
    callCount: number;
    recentSessions: SessionRow[];
  };
}

export default function DashboardPage() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setLoading(false);
      return;
    }
    getAccessToken()
      .then((token) => {
        if (!token) {
          setLoading(false);
          return;
        }
        return fetch(`/api/dashboard/stats?privyId=${encodeURIComponent(user.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => {
            if (!r.ok) throw new Error(`${r.status}`);
            return r.json();
          })
          .then(setData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [ready, authenticated, user, getAccessToken]);

  const glassCard = 'border border-[var(--border)] bg-[var(--card-bg)]';

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  } as const;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
      <BackgroundEffect />
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 text-[var(--text-muted)]">
              Dashboard
            </div>
            <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] text-[var(--text)]">
              Your sessions,
              <br />
              <span className="text-[var(--text-muted)]">on-chain.</span>
            </h1>
          </div>

          {!ready ? null : !authenticated ? (
            <div
              className={`rounded-3xl p-16 text-center border ${glassCard}`}
              style={glassStyle}
            >
              <Wallet className="w-12 h-12 mx-auto mb-5 text-[var(--text-muted)]" />
              <p className="text-base mb-2 text-[var(--text-secondary)]">
                Connect your wallet to view your dashboard.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Use the Connect button in the top-right corner.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-20 text-sm font-mono animate-pulse text-[var(--text-muted)]">
              Loading dashboard…
            </div>
          ) : error ? (
            <div
              className={`rounded-3xl p-16 text-center border ${glassCard}`}
              style={glassStyle}
            >
              <p className="text-base text-[var(--text-secondary)]">
                {error === '404' ? 'No data found for this wallet.' : `Error: ${error}`}
              </p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  icon={ShieldCheck}
                  label="Identity"
                  value={data.user.erc8004TokenId ? `#${data.user.erc8004TokenId}` : 'Not minted'}
                />
                <StatCard
                  icon={Wallet}
                  label="KYA Level"
                  value={String(data.user.kyaLevel)}
                />
                <StatCard
                  icon={DollarSign}
                  label={data.role === 'creator' ? 'Earnings' : 'Spent'}
                  value={`$${(data.role === 'creator' ? data.creator.totalEarnings : data.agent.totalSpent).toFixed(2)}`}
                />
                <StatCard
                  icon={Activity}
                  label="Total calls"
                  value={String(data.role === 'creator' ? data.creator.callCount : data.agent.callCount)}
                />
              </div>

              {/* Creator skills */}
              {data.creator.skillCount > 0 && (
                <section
                  className={`rounded-3xl p-8 border transition-colors duration-700 ${glassCard}`}
                  style={glassStyle}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">
                      Your skills · {data.creator.skillCount} created
                    </div>
                    <Link
                      href="/create"
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-70 transition-opacity text-[var(--text-muted)]"
                    >
                      List new
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.creator.skills.map((skill) => (
                      <Link
                        key={skill.id}
                        href={`/skill/${skill.id}`}
                        className="flex items-center justify-between p-4 rounded-2xl border transition-all hover:opacity-80 border-[var(--border-light)] bg-[var(--bg-secondary)]"
                      >
                        <div className="flex items-baseline gap-3 min-w-0">
                          <span className="font-sans font-semibold text-base truncate text-[var(--text)]">
                            {skill.name}
                          </span>
                          {skill.slug && (
                            <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                              /{skill.slug}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs tabular-nums shrink-0 text-[var(--text-muted)]">
                          {skill.sessionCount} sessions · ${skill.pricePerCall?.toFixed(2) ?? 'FREE'}/call
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Agents */}
              {data.agent.agents.length > 0 && (
                <section
                  className={`rounded-3xl p-8 border transition-colors duration-700 ${glassCard}`}
                  style={glassStyle}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 text-[var(--text-muted)]">
                    Your agents · {data.agent.agents.length} owned
                  </div>
                  <div className="space-y-2">
                    {data.agent.agents.map((agent) => (
                      <Link
                        key={agent.id}
                        href={`/agent/${agent.id}`}
                        className="flex items-center justify-between p-4 rounded-2xl border transition-all hover:opacity-80 border-[var(--border-light)] bg-[var(--bg-secondary)]"
                      >
                        <span className="font-sans font-semibold text-base text-[var(--text)]">
                          {agent.name}
                        </span>
                        <div className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
                          Trust {agent.trustScore ?? '–'} · {agent.sessionCount} sessions
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Sessions */}
              <section
                className={`rounded-3xl p-8 border transition-colors duration-700 ${glassCard}`}
                style={glassStyle}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 text-[var(--text-muted)]">
                  Recent sessions
                </div>
                <SessionTable
                  sessions={data.role === 'creator' ? data.creator.recentSessions : data.agent.recentSessions}
                  viewAs={data.role}
                />
              </section>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl p-5 border transition-colors duration-700 border-[var(--border)] bg-[var(--card-bg)]"
      style={{
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {label}
        </span>
      </div>
      <div className="font-mono text-xl md:text-2xl font-bold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </motion.div>
  );
}

function SessionTable({
  sessions,
  viewAs,
}: {
  sessions: SessionRow[];
  viewAs: 'creator' | 'agent';
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-center py-10 text-[var(--text-muted)]">
        No sessions yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Date
            </th>
            <th className="text-left py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              {viewAs === 'creator' ? 'Agent' : 'Skill'}
            </th>
            <th className="text-right py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Calls
            </th>
            <th className="text-right py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Budget
            </th>
            <th className="text-right py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Spent
            </th>
            <th className="text-left py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Status
            </th>
            <th className="text-left py-3 px-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">
              Attestation
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="border-b border-[var(--border-light)]"
            >
              <td className="py-3 px-3 text-[var(--text-muted)]">
                {new Date(s.openedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
              <td className="py-3 px-3 text-[var(--text)]">
                {viewAs === 'creator' ? s.agent?.name ?? '–' : s.skill?.name ?? '–'}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                {s.callCount}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                ${s.budgetTotal.toFixed(2)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                ${(s.budgetTotal - s.budgetRemaining).toFixed(2)}
              </td>
              <td className="py-3 px-3">
                <StatusPill status={s.status} />
              </td>
              <td className="py-3 px-3 truncate max-w-[120px] text-[var(--text-muted)]">
                {s.basAttestationUid ? s.basAttestationUid.slice(0, 10) + '…' : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { dot: string; text: string }> = {
    settled: { dot: 'bg-[var(--text)]', text: 'text-[var(--text)]' },
    refunded: { dot: 'bg-[var(--text-muted)]', text: 'text-[var(--text-muted)]' },
    active: { dot: 'bg-[var(--text)]', text: 'text-[var(--text)]' },
    funded: { dot: 'bg-[var(--text-secondary)]', text: 'text-[var(--text-secondary)]' },
  };
  const style = styles[status] ?? {
    dot: 'bg-[var(--text-muted)]',
    text: 'text-[var(--text-muted)]',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
