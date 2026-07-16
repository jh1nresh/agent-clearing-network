"use client";

/**
 * Dojo home — marketplace-first landing (matching app.maiat.io layout).
 *
 * Vertical stack, no sidebars:
 *   - Floating glass navbar
 *   - Centered hero + CTAs
 *   - LandingHero (stats → ticker → filters → grid)
 *   - For Developers (API quick-start)
 *   - Multi-column footer
 */

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Moon, Sun } from "lucide-react";
import { LandingHero } from "@/components/landing/LandingHero";
import { useDarkMode } from "@/app/DarkModeContext";

function DarkToggle() {
  const { isDark, toggleDark } = useDarkMode();
  return (
    <button
      onClick={toggleDark}
      aria-label="Toggle theme"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)] transition-all hover:text-[var(--text)] active:scale-90"
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

function WalletPill() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  if (!ready) return null;

  if (authenticated && user) {
    const displayName =
      user.email?.address?.split("@")[0] ||
      user.google?.name ||
      (user.wallet?.address
        ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
        : "Agent");

    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text)]" />
          {displayName}
        </span>
        <button
          onClick={logout}
          className="text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-1.5 rounded-full bg-[var(--text)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--bg)] transition-opacity hover:opacity-80"
    >
      <span className="text-[10px]">⬡</span>
      Connect
    </button>
  );
}

/* ── API step for developer section ── */
function ApiStep({
  step,
  method,
  path,
  desc,
  code,
}: {
  step: string;
  method: string;
  path: string;
  desc: string;
  code: string;
}) {
  return (
    <div className="border-b border-[var(--border-light)] py-5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-secondary)] font-mono text-[11px] font-semibold text-[var(--text-muted)]">
          {step}
        </span>
        {method && (
          <span className="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
            {method}
          </span>
        )}
        <span className="font-mono text-[12px] text-[var(--text-muted)]">
          {path}
        </span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
        {desc}
      </p>
      <pre className="code-block mt-3">{code}</pre>
    </div>
  );
}

export default function DojoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {/* ═══ AMBIENT GRADIENT MESH ═══ */}
      <div className="atmosphere" />

      {/* ═══ FLOATING PILL NAVBAR ═══ */}
      <div className="fixed left-0 right-0 top-0 z-50 flex justify-center px-6 pt-4">
        <nav className="glass-nav flex w-full max-w-4xl items-center justify-between px-5 py-2.5">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--text)]">
              <span className="text-[11px] font-black text-[var(--bg)]">D</span>
            </span>
            <span className="text-[14px] font-bold tracking-tight text-[var(--text)]">
              The Dojo
            </span>
          </Link>
          {/* Center links */}
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/demo" className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
              Markets
            </Link>
            <Link href="/leaderboard" className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
              Leaderboard
            </Link>
            <Link href="/dashboard" className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
              Dashboard
            </Link>
            <a href="#developers" className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]">
              Docs
            </a>
          </div>
          {/* Right: dark mode + connect */}
          <div className="flex items-center gap-2">
            <DarkToggle />
            <WalletPill />
          </div>
        </nav>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-16 pt-24">
        {/* ═══ HERO ═══ */}
        <section className="animate-fade-in-up mb-24 text-center">
          {/* Dark badge pill — matches app.maiat.io */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-4 py-1.5">
            <span className="live-dot live-dot-inverted" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--bg)]">
              Mainnet Live
            </span>
          </div>
          {/* Two-tone heading — first line dark, second line muted */}
          <h1 className="heading-xl">
            Skill Marketplace
            <br />
            <span className="heading-xl-muted">for AI Agents.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-md text-[16px] leading-relaxed text-[var(--text-secondary)]">
            List your API as a skill. Agents pay per call. Every call is
            evaluated, attested on BAS, and builds on-chain trust.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/create" className="btn-primary">
              List a Skill →
            </Link>
            <a href="#developers" className="btn-outline">
              REST API Docs
            </a>
          </div>
        </section>

        {/* ═══ MARKETPLACE (stats → ticker → filters → grid) ═══ */}
        <main className="mb-20">
          <LandingHero />
        </main>

        {/* ═══ FOR DEVELOPERS ═══ */}
        <section id="developers" className="mb-20">
          <div className="mb-8 text-center">
            <span className="label-sm">For Developers</span>
            <h2 className="heading-lg mt-3 text-[var(--text)]">
              One HTTP call per skill.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[var(--text-secondary)]">
              Your agent doesn&apos;t need a wallet, sessions, or nonces. Get an
              API key, pick a skill, and call it.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="glass-card p-6">
              <ApiStep
                step="01"
                method="GET"
                path="/api/v1/skills"
                desc="Browse available skills and their prices."
                code={`curl https://maiat-dojo.vercel.app/api/v1/skills`}
              />
              <ApiStep
                step="02"
                method="GET"
                path="/api/v1/balance"
                desc="Check your remaining credits."
                code={`curl https://maiat-dojo.vercel.app/api/v1/balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
              />
            </div>
            <div className="glass-card p-6">
              <ApiStep
                step="03"
                method="POST"
                path="/api/v1/run"
                desc="Call a skill. One request = find, execute, evaluate, return."
                code={`curl -X POST https://maiat-dojo.vercel.app/api/v1/run \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"skill":"web-scraper","input":{"url":"…"}}'`}
              />
              <ApiStep
                step="04"
                method=""
                path="Response"
                desc="Result, cost, balance, and trust score in one response."
                code={`{
  "result": { "content": "..." },
  "cost": 0.003,
  "balance": 9.997,
  "score": 1.0,
  "session_id": "cls...",
  "latency_ms": 842
}`}
              />
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-auto border-t border-[var(--border)] pt-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <span className="text-[15px] font-bold text-[var(--text)]">
                The Dojo
              </span>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Skill marketplace for the
                <br />
                agent economy.
              </p>
            </div>
            <div>
              <span className="label-sm">Product</span>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href="/leaderboard"
                    className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    Leaderboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/demo"
                    className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <span className="label-sm">Developers</span>
              <ul className="mt-3 space-y-2">
                <li>
                  <a
                    href="#developers"
                    className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    REST API
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/maiat-protocol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <span className="label-sm">Get Started</span>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/create" className="btn-primary w-full justify-center text-[12px]">
                  List a Skill
                </Link>
                <a href="#developers" className="btn-outline w-full justify-center text-[12px]">
                  View Docs
                </a>
              </div>
            </div>
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-[var(--border)] py-4">
            <span className="text-[12px] text-[var(--text-muted)]">
              &copy; 2026 Maiat Protocol. All rights reserved.
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">
              BSC Mainnet
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
