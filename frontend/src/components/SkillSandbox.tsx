'use client';

import { useState, useEffect } from 'react';

type Symbol = 'BTC' | 'ETH' | 'BNB';
type Timeframe = '1h' | '4h' | '24h';

interface PriceData {
  token: string;
  price_usd: number;
  twap_1h: number;
  change_24h: number;
  source: string;
  timestamp: string;
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatChange(n: number): string {
  const pct = (n * 100).toFixed(2);
  return `${n > 0 ? '+' : ''}${pct}%`;
}

export default function SkillSandbox() {
  const [symbol, setSymbol] = useState<Symbol>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [data, setData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  // Fetch on symbol change + 5s poll
  useEffect(() => {
    const controller = new AbortController();

    async function fetchPrice(sym: Symbol) {
      setLoading(true);
      try {
        const res = await fetch('/api/skills-internal/price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sym }),
          signal: controller.signal,
        });
        if (res.ok) {
          const json = await res.json() as PriceData;
          setData(json);
          setSecondsSinceUpdate(0);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      } finally {
        setLoading(false);
      }
    }

    fetchPrice(symbol);
    const id = setInterval(() => fetchPrice(symbol), 5000);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [symbol]);

  // Tick every second for "Updated Xs ago"
  useEffect(() => {
    const id = setInterval(() => setSecondsSinceUpdate((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const changeColor =
    data && data.change_24h > 0
      ? 'var(--text)'
      : 'var(--text-muted)';

  const twapLabel = `TWAP ${timeframe.toUpperCase()}`;

  function updatedText(): string {
    if (!data) return '—';
    if (secondsSinceUpdate < 5) return 'just now';
    return `${secondsSinceUpdate}s ago`;
  }

  return (
    <section
      style={{
        borderTop: '4px double var(--text)',
        borderBottom: '4px double var(--text)',
      }}
      className="py-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Live Oracle Output
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Live
          </span>
        </span>
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {(['BTC', 'ETH', 'BNB'] as Symbol[]).map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] transition-colors ${
                symbol === s
                  ? 'bg-[var(--text)] text-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['1h', '4h', '24h'] as Timeframe[]).map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] transition-colors ${
                timeframe === t
                  ? 'bg-[var(--text)] text-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Data */}
      {loading && !data ? (
        <div className="font-mono text-[11px] text-[var(--text-muted)]">
          Loading…
        </div>
      ) : data ? (
        <>
          {/* Primary metrics */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums text-[var(--text)]">
                {formatPrice(data.price_usd)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-1 text-[var(--text-muted)]">
                Price (USD)
              </div>
            </div>
            <div>
              <div
                className="font-mono text-2xl font-bold tabular-nums"
                style={{ color: changeColor }}
              >
                {formatChange(data.change_24h)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-1 text-[var(--text-muted)]">
                Change (24H)
              </div>
            </div>
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <div className="font-mono text-sm font-bold tabular-nums text-[var(--text-secondary)]">
                {formatPrice(data.twap_1h)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-1 text-[var(--text-muted)]">
                {twapLabel}
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-[var(--text-secondary)]">
                {data.source}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] mt-1 text-[var(--text-muted)]">
                Source
              </div>
            </div>
          </div>

          <div className="text-[9px] font-mono text-[var(--text-muted)]">
            Updated {updatedText()}
          </div>
        </>
      ) : null}
    </section>
  );
}
