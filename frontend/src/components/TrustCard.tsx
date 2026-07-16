'use client';

import { BadgeCheck, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useDarkMode } from '@/app/DarkModeContext';

const ERC8004_TESTNET_ADDRESS = '0xbb1d304179bdd577d5ef15fec91a5ba9756a6e41';
const BSCSCAN_TESTNET = 'https://testnet.bscscan.com';

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

interface Props {
  trustScore: number;
  passedSessions: number;
  failedSessions: number;
  totalSessions: number;
  medianLatencyMs: number | null;
  sparkline: number[];
  heatmap: HeatmapBucket[];
  attestations: Attestation[];
  creator: {
    displayName: string | null;
    walletAddress: string | null;
    erc8004TokenId: string | null;
  };
}

function truncateUid(uid: string): string {
  if (uid.length < 14) return uid;
  return `${uid.slice(0, 8)}…${uid.slice(-6)}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) {
    return (
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Awaiting data
      </div>
    );
  }
  const W = 180;
  const H = 44;
  const max = 100;
  const min = 0;
  const step = W / (series.length - 1);
  const path = series
    .map((v, i) => {
      const x = (i * step).toFixed(2);
      const y = (H - ((v - min) / (max - min)) * H).toFixed(2);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const areaPath = `${path} L${W},${H} L0,${H} Z`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible text-[var(--text)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End-point dot */}
      <circle
        cx={(series.length - 1) * step}
        cy={H - ((series[series.length - 1] - min) / (max - min)) * H}
        r={2.5}
        fill="currentColor"
      />
    </svg>
  );
}

function Heatmap({ buckets, isDark }: { buckets: HeatmapBucket[]; isDark: boolean }) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex items-end gap-1.5">
      {buckets.map((b, i) => {
        const intensity = b.count === 0 ? 0 : 0.15 + 0.85 * (b.count / maxCount);
        // Parse as local date to avoid UTC shift (ISO "YYYY-MM-DD" → UTC midnight)
        const label = new Date(`${b.date}T12:00:00`).toLocaleDateString('en-US', {
          weekday: 'short',
        });
        const bg =
          b.count === 0
            ? isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
            : isDark
              ? `rgba(255,255,255,${intensity})`
              : `rgba(0,0,0,${intensity})`;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className="w-7 h-10 transition-colors"
              style={{ backgroundColor: bg }}
              title={`${b.date}: ${b.count} session${b.count === 1 ? '' : 's'}`}
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {label[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrendPill({
  sparkline,
  isDark,
}: {
  sparkline: number[];
  isDark: boolean;
}) {
  if (sparkline.length < 2) return null;
  const first = sparkline[0];
  const last = sparkline[sparkline.length - 1];
  const delta = last - first;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const colorClass =
    delta > 0
      ? 'text-[var(--text)]'
      : delta < 0
        ? 'text-[var(--text-muted)]'
        : 'text-[var(--text-muted)]';
  const sign = delta > 0 ? '+' : '';
  return (
    <div className={`flex items-center gap-1 text-xs font-mono ${colorClass}`}>
      <Icon className="w-3 h-3" />
      <span className="tabular-nums">
        {sign}
        {delta}
      </span>
    </div>
  );
}

export default function TrustCard({
  trustScore,
  passedSessions,
  failedSessions,
  totalSessions,
  medianLatencyMs,
  sparkline,
  heatmap,
  attestations,
  creator,
}: Props) {
  const { isDark } = useDarkMode();

  const creatorVerified = !!creator.erc8004TokenId;
  const erc8004Url = `${BSCSCAN_TESTNET}/address/${ERC8004_TESTNET_ADDRESS}`;

  return (
    <section
      className={`p-8 border transition-colors duration-700 border-[var(--border)]`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-8">
        <div
          className={`font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)]`}
        >
          Trust dossier
        </div>
        <div
          className={`font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-muted)]`}
        >
          BSC · BAS
        </div>
      </div>

      {/* Top row: score + sparkline */}
      <div className="flex items-start gap-8 mb-10">
        <div>
          <div
            className="font-mono text-[64px] leading-none tabular-nums tracking-[-0.04em] text-[var(--text)]"
          >
            {trustScore}
          </div>
          <div
            className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-2 text-[var(--text-secondary)]`}
          >
            Trust score
          </div>
        </div>
        <div className="flex-1 flex flex-col items-end gap-2">
          <TrendPill sparkline={sparkline} isDark={isDark} />
          <Sparkline series={sparkline} />
          <div
            className={`text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]`}
          >
            Last {sparkline.length || 0} sessions
          </div>
        </div>
      </div>

      {/* Stat row: PASS / FAIL / LATENCY */}
      <div
        className={`grid grid-cols-3 gap-4 mb-10 pt-6 border-t border-[var(--border)]`}
      >
        <div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-bold tabular-nums text-[var(--text)]`}
            >
              {passedSessions}
            </span>
            <span className="text-[10px] font-bold text-[var(--text)] uppercase tracking-[0.15em]">
              pass
            </span>
          </div>
          <div
            className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 text-[var(--text-secondary)]`}
          >
            BAS attestations
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-bold tabular-nums text-[var(--text)]`}
            >
              {failedSessions}
            </span>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em]">
              fail
            </span>
          </div>
          <div
            className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 text-[var(--text-secondary)]`}
          >
            Refunded sessions
          </div>
        </div>
        <div>
          <div
            className={`font-mono text-2xl font-bold tabular-nums text-[var(--text)]`}
          >
            {medianLatencyMs !== null ? `${medianLatencyMs}` : '—'}
            {medianLatencyMs !== null && (
              <span
                className={`text-xs font-bold ml-1 text-[var(--text-secondary)]`}
              >
                ms
              </span>
            )}
          </div>
          <div
            className={`text-[9px] font-bold uppercase tracking-[0.2em] mt-1 text-[var(--text-secondary)]`}
          >
            Median latency
          </div>
        </div>
      </div>

      {/* 7-day heatmap */}
      <div
        className={`mb-10 pt-6 border-t border-[var(--border)]`}
      >
        <div
          className={`font-mono text-[9px] uppercase tracking-[0.15em] mb-4 text-[var(--text-secondary)]`}
        >
          Last 7 days activity
        </div>
        <Heatmap buckets={heatmap} isDark={isDark} />
      </div>

      {/* BAS attestations list */}
      <div
        className={`mb-10 pt-6 border-t border-[var(--border)]`}
      >
        <div className="flex items-center justify-between mb-4">
          <div
            className={`font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)]`}
          >
            On-chain attestations
          </div>
          <div
            className={`text-[9px] font-mono tabular-nums text-[var(--text-muted)]`}
          >
            {attestations.length} / {totalSessions}
          </div>
        </div>

        {attestations.length === 0 ? (
          <div
            className={`text-xs py-2 text-[var(--text-muted)]`}
          >
            No BAS records yet. The first settled session will attest on-chain.
          </div>
        ) : (
          <div className="space-y-2">
            {attestations.map((a) => {
              const isPass = a.status === 'settled';
              return (
                <a
                  key={a.sessionId}
                  href={`${BSCSCAN_TESTNET}/search?q=${a.uid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 px-4 py-3 border border-[var(--border)] transition-all no-underline hover:bg-[var(--bg-secondary)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full ${
                        isPass
                          ? 'bg-[var(--bg-secondary)] text-[var(--text)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {isPass ? 'pass' : 'fail'}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums truncate text-[var(--text-secondary)]">
                      {truncateUid(a.uid)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] text-[var(--text-muted)]`}
                    >
                      {formatRelative(a.settledAt)}
                    </span>
                    <ExternalLink
                      className={`w-3 h-3 transition-opacity opacity-40 group-hover:opacity-100 text-[var(--text-secondary)]`}
                    />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Creator verify row */}
      <div
        className={`pt-6 border-t border-[var(--border)]`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {creatorVerified ? (
              <BadgeCheck className="w-4 h-4 text-[var(--text)]" />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-[var(--border)]" />
            )}
            <div>
              <div
                className={`font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)]`}
              >
                Creator identity
              </div>
              <div className="font-mono text-[11px] tabular-nums mt-0.5 text-[var(--text-secondary)]">
                {creatorVerified
                  ? `KYA-0 · agentId ${creator.erc8004TokenId}`
                  : 'Unverified'}
              </div>
            </div>
          </div>
          {creatorVerified && (
            <a
              href={erc8004Url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-opacity hover:opacity-70 no-underline text-[var(--text-secondary)]`}
            >
              ERC-8004
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
