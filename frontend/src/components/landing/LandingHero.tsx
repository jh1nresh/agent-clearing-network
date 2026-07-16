"use client";

/**
 * LandingHero — marketplace skills grid.
 *
 * Layout (matching app.maiat.io):
 *   - Protocol stats row (3 stat-cards)
 *   - Horizontal activity ticker (scrolling event cards)
 *   - Category filter pills
 *   - Full-width skills grid (3-col desktop, 2-col tablet, 1-col mobile)
 *
 * No sidebars. No editorial hierarchy. Just a marketplace grid.
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { type SkillRankItem } from "./SkillRankList";

export interface LandingHeroProps {
  pending?: boolean;
  onSubmit?: (text: string) => void;
}

/* ── Activity event types ── */
type ActivityEvent = {
  id: string;
  type: "call" | "settle" | "attest" | "list";
  agent?: string;
  skill?: string;
  amount?: string;
  trust?: number;
  verdict?: "PASS" | "FAIL";
  ts: number;
};

/* ── Mock data ── */
const SEED_EVENTS: ActivityEvent[] = [
  { id: "e01", type: "call", agent: "0x4f2...c8a", skill: "Token Price Oracle", ts: Date.now() - 4000 },
  { id: "e02", type: "settle", agent: "0xb91...2d7", skill: "Echo Test", amount: "0.015", ts: Date.now() - 9000 },
  { id: "e03", type: "attest", agent: "0x7d1...3f2", trust: 87, verdict: "PASS", ts: Date.now() - 18000 },
  { id: "e04", type: "call", agent: "0xe33...a01", skill: "Sentiment Analyzer", ts: Date.now() - 26000 },
  { id: "e05", type: "settle", agent: "0x4f2...c8a", skill: "Token Price Oracle", amount: "0.008", ts: Date.now() - 35000 },
  { id: "e06", type: "attest", agent: "0xb91...2d7", trust: 92, verdict: "PASS", ts: Date.now() - 48000 },
  { id: "e07", type: "list", skill: "Code Review Agent", ts: Date.now() - 65000 },
  { id: "e08", type: "call", agent: "0x1a8...f90", skill: "Echo Test", ts: Date.now() - 80000 },
];

const DRIP_POOL: Omit<ActivityEvent, "id" | "ts">[] = [
  { type: "call", agent: "0xc77...e12", skill: "Token Price Oracle" },
  { type: "settle", agent: "0x4f2...c8a", skill: "Echo Test", amount: "0.012" },
  { type: "attest", agent: "0xc77...e12", trust: 71, verdict: "PASS" },
  { type: "call", agent: "0xb91...2d7", skill: "Sentiment Analyzer" },
  { type: "settle", agent: "0xe33...a01", skill: "Token Price Oracle", amount: "0.009" },
  { type: "list", skill: "Data Aggregator v2" },
  { type: "call", agent: "0x1a8...f90", skill: "Code Review Agent" },
  { type: "attest", agent: "0x4f2...c8a", trust: 95, verdict: "PASS" },
];

/* ── Helpers ── */
function formatAge(ts: number, now: number) {
  if (now === 0) return "";
  const sec = Math.floor((now - ts) / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function tickerLabel(type: ActivityEvent["type"]): string {
  switch (type) {
    case "call": return "CALL";
    case "settle": return "SETTLE";
    case "attest": return "ATTEST";
    case "list": return "NEW";
  }
}

function tickerDetail(event: ActivityEvent): string {
  switch (event.type) {
    case "call": return event.skill ?? "";
    case "settle": return `${event.amount} USDC`;
    case "attest": return `${event.verdict} \u00b7 ${event.trust}`;
    case "list": return event.skill ?? "";
  }
}

/* ── Ticker card — compact horizontal strip ── */
function TickerCard({ event, now }: { event: ActivityEvent; now: number }) {
  const isAccent = event.type === "settle" || event.type === "list";
  return (
    <div className="ticker-card">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {tickerLabel(event.type)}
      </span>
      <span
        className={`font-mono text-[11px] ${
          isAccent ? "font-semibold text-[var(--text)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {event.agent ?? event.skill ?? ""}
      </span>
      {event.amount && (
        <span className="font-mono text-[11px] text-[var(--text)]">{event.amount} USDC</span>
      )}
      {event.verdict && (
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">{event.verdict} · {event.trust}</span>
      )}
      <span className="font-mono text-[10px] text-[var(--text-muted)]">
        {formatAge(event.ts, now)}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════ */
export function LandingHero(_props: LandingHeroProps) {
  const [skills, setSkills] = useState<SkillRankItem[] | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const dripIndex = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/skills?sort=trust&limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSkills(data.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Seed events client-side only to avoid SSR/hydration timestamp mismatch
    setEvents(SEED_EVENTS);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const drip = () => {
      const idx = dripIndex.current % DRIP_POOL.length;
      const evt: ActivityEvent = {
        ...DRIP_POOL[idx],
        id: `d${Date.now()}`,
        ts: Date.now(),
      };
      dripIndex.current++;
      setEvents((prev) => [evt, ...prev].slice(0, 12));
      timeout = setTimeout(drip, 10000 + Math.random() * 5000);
    };
    timeout = setTimeout(drip, 12000);
    return () => clearTimeout(timeout);
  }, []);

  const skillCount = skills?.length ?? 0;

  /* Derive categories from loaded skills */
  const categories = skills
    ? ["all", ...Array.from(new Set(skills.map((s) => s.category ?? "misc")))]
    : ["all"];

  const q = query.trim().toLowerCase();
  const filtered =
    skills === null
      ? null
      : skills.filter((s) => {
          const matchCat = filter === "all" || (s.category ?? "misc") === filter;
          const matchQ =
            !q ||
            s.name.toLowerCase().includes(q) ||
            (s.description ?? "").toLowerCase().includes(q);
          return matchCat && matchQ;
        });

  return (
    <div className="flex w-full flex-col gap-12">
      {/* ═══ PROTOCOL STATS ═══ */}
      <div className="animate-fade-in-up grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card glass-shimmer">
          <span className="text-[32px] font-bold leading-none text-[var(--text)]">
            {skillCount || "\u2014"}
          </span>
          <span className="label-sm mt-2">Skills Listed</span>
        </div>
        <div className="stat-card glass-shimmer">
          <span className="text-[32px] font-bold leading-none text-[var(--text)]">
            0.142
          </span>
          <span className="label-sm mt-2">USDC Settled</span>
        </div>
        <div className="stat-card glass-shimmer">
          <span className="text-[32px] font-bold leading-none text-[var(--text)]">
            139
          </span>
          <span className="label-sm mt-2">BAS Attestations</span>
        </div>
      </div>

      {/* ═══ MARQUEE ACTIVITY TICKER ═══ */}
      {events.length > 0 && (
        <div className="animate-fade-in -mx-6 border-y border-[var(--border)]">
          <div className="ticker-scroll py-1">
            {/* Duplicate for seamless loop */}
            <div className="ticker-track" aria-hidden="false">
              {[...events, ...events].map((e, i) => (
                <TickerCard key={`${e.id}-${i}`} event={e} now={now} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SEARCH BAR ═══ */}
      <div className="relative">
        <svg
          width="14"
          height="14"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          fill="none" stroke="currentColor" strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx={11} cy={11} r={8} />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills…"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--card-bg)] py-2.5 pl-9 pr-4 font-mono text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--text)] transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* ═══ CATEGORY FILTER PILLS ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`filter-pill ${filter === cat ? "filter-pill-active" : ""}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ═══ SKILLS GRID — full width, no sidebar ═══ */}
      {filtered === null ? (
        <p className="text-center text-[14px] text-[var(--text-muted)]">
          Loading&hellip;
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-[14px] text-[var(--text-muted)]">
          No skills found.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/skill/${s.id}`}
              className="glass-card group block p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold leading-snug text-[var(--text)]">
                  {s.name}
                </h3>
                <span className="shrink-0 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)] backdrop-blur-sm">
                  {s.pricePerCall != null && s.pricePerCall > 0
                    ? `$${s.pricePerCall.toFixed(3)}`
                    : "Free"}
                </span>
              </div>
              {s.description && (
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  {s.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-sm">
                  {s.category ?? "misc"}
                </span>
                {s.trustScore != null && s.trustScore > 0 && (
                  <span className="trust-badge trust-badge-verified">
                    {Math.round(s.trustScore)}\u2605
                  </span>
                )}
                <span className="ml-auto text-[12px] text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                  View &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default LandingHero;
