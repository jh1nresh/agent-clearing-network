'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, PlayCircle, Sparkles } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';

interface StepResult {
  status: 'idle' | 'running' | 'success' | 'error';
  data?: unknown;
  error?: string;
}

const STEPS = [
  {
    num: 'I',
    title: 'Register agent identity (KYA-0)',
    desc: 'Mint an ERC-8004 identity on BSC. This gives the agent an on-chain ID.',
  },
  {
    num: 'II',
    title: 'Discover skill in marketplace',
    desc: 'Browse the Dojo marketplace and find an active skill to call.',
  },
  {
    num: 'III',
    title: 'Hit gateway → receive 402 + x402 headers',
    desc: 'Call the gateway without a session. Get back a 402 with payment discovery headers.',
  },
  {
    num: 'IV',
    title: 'Open session (fund escrow)',
    desc: 'Open an ERC-8183 escrow session. Budget is locked on-chain.',
  },
  {
    num: 'V',
    title: 'Call skill N times → per-call eval → scores',
    desc: 'Invoke the echo skill 3 times via gateway. Each call is evaluated for delivery, format, and SLA.',
  },
  {
    num: 'VI',
    title: 'Close session → settle → attest → trust update',
    desc: 'Close the session. Settlement, BAS attestation, and trust score update fire.',
  },
];

export default function DemoPage() {
  const [results, setResults] = useState<StepResult[]>(
    STEPS.map(() => ({ status: 'idle' as const }))
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [skillSlug] = useState('echo-test');

  function updateStep(i: number, r: StepResult) {
    setResults((prev) => {
      const next = [...prev];
      next[i] = r;
      return next;
    });
  }

  async function runStep1() {
    updateStep(0, { status: 'running' });
    try {
      const res = await fetch('/api/skills?limit=5');
      const data = await res.json();
      updateStep(0, {
        status: 'success',
        data: {
          skills: data.skills?.length ?? 0,
          message: 'Skills fetched. KYA-0 mint requires wallet connection.',
        },
      });
    } catch (e) {
      updateStep(0, { status: 'error', error: (e as Error).message });
    }
  }

  async function runStep2() {
    updateStep(1, { status: 'running' });
    try {
      const res = await fetch('/api/skills?limit=20');
      const data = await res.json();
      const echo = data.skills?.find(
        (s: { gatewaySlug?: string }) => s.gatewaySlug === skillSlug
      );
      if (!echo) throw new Error(`Skill '${skillSlug}' not found. Run seed first.`);
      updateStep(1, {
        status: 'success',
        data: {
          id: echo.id,
          name: echo.name,
          slug: echo.gatewaySlug,
          pricePerCall: echo.pricePerCall,
        },
      });
    } catch (e) {
      updateStep(1, { status: 'error', error: (e as Error).message });
    }
  }

  async function runStep3() {
    updateStep(2, { status: 'running' });
    try {
      const res = await fetch(`/api/gateway/skills/${skillSlug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        if (k.toLowerCase().startsWith('x-payment')) headers[k] = v;
      });
      const body = await res.json();
      updateStep(2, {
        status: res.status === 402 ? 'success' : 'error',
        data: { httpStatus: res.status, headers, body },
        error: res.status !== 402 ? `Expected 402, got ${res.status}` : undefined,
      });
    } catch (e) {
      updateStep(2, { status: 'error', error: (e as Error).message });
    }
  }

  async function runStep4() {
    updateStep(3, { status: 'running' });
    try {
      const skillRes = await fetch('/api/skills?limit=20');
      const skillData = await skillRes.json();
      const echo = skillData.skills?.find(
        (s: { gatewaySlug?: string }) => s.gatewaySlug === skillSlug
      );
      if (!echo) throw new Error('Echo skill not found');

      const res = await fetch('/api/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: echo.id, budgetUsdc: 1.0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSessionId(data.session?.id ?? null);
      updateStep(3, { status: 'success', data: data.session });
    } catch (e) {
      updateStep(3, {
        status: 'error',
        error: `${(e as Error).message} — Session open requires Privy auth in production. For demo, seed test sessions manually.`,
      });
    }
  }

  async function runStep5() {
    updateStep(4, { status: 'running' });
    if (!sessionId) {
      updateStep(4, {
        status: 'error',
        error: 'No session — run Step IV first or provide session ID.',
      });
      return;
    }
    try {
      const callResults = [];
      for (let i = 0; i < 3; i++) {
        const body = JSON.stringify({
          message: `call-${i + 1}`,
          ts: Date.now(),
        });
        const res = await fetch(`/api/gateway/skills/${skillSlug}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dojo-Auth': 'demo-sig',
            'X-Dojo-JobId': sessionId,
            'X-Dojo-AgentTokenId': '1',
            'X-Dojo-Nonce': String(i + 1),
            'X-Dojo-ExpiresAt': String(Math.floor(Date.now() / 1000) + 60),
            'X-Dojo-RequestHash':
              '0x0000000000000000000000000000000000000000000000000000000000000000',
          },
          body,
        });
        const data = await res.json();
        callResults.push({
          nonce: i + 1,
          status: res.status,
          budgetRemaining: res.headers.get('X-Dojo-BudgetRemaining'),
          callCount: res.headers.get('X-Dojo-CallCount'),
          body: data,
        });
      }
      updateStep(4, { status: 'success', data: callResults });
    } catch (e) {
      updateStep(4, { status: 'error', error: (e as Error).message });
    }
  }

  async function runStep6() {
    updateStep(5, { status: 'running' });
    if (!sessionId) {
      updateStep(5, { status: 'error', error: 'No session — run Step IV first.' });
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privyId: 'demo' }),
      });
      const data = await res.json();
      updateStep(5, {
        status: res.ok ? 'success' : 'error',
        data,
        error: !res.ok ? data.error : undefined,
      });
    } catch (e) {
      updateStep(5, { status: 'error', error: (e as Error).message });
    }
  }

  const runners = [runStep1, runStep2, runStep3, runStep4, runStep5, runStep6];

  const glassCard = 'border border-[var(--border)] bg-[var(--card-bg)]';

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  } as const;

  const statusStyle = (s: StepResult['status']) => {
    if (s === 'success') return 'text-[var(--text)] border-[var(--border)] bg-[var(--bg-secondary)]';
    if (s === 'error') return 'text-[var(--text-muted)] border-[var(--border)] bg-[var(--bg-secondary)]';
    if (s === 'running') return 'text-[var(--text-secondary)] border-[var(--border)] bg-[var(--bg-secondary)]';
    return 'text-[var(--text-muted)] border-[var(--border-light)] bg-[var(--bg-secondary)]';
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
      <BackgroundEffect />
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 transition-opacity hover:opacity-70 text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to marketplace
          </Link>

          {/* Header */}
          <header className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)] mb-5">
              <Sparkles className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                Live walkthrough
              </span>
            </div>
            <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] mb-5 text-[var(--text)]">
              Watch it settle.
            </h1>
            <p className="text-base max-w-xl mx-auto text-[var(--text-muted)]">
              Six steps. Real API calls. The full agent-to-skill lifecycle — from KYA-0
              mint to on-chain settlement.
            </p>
          </header>

          {/* Steps */}
          <div className="space-y-4">
            {STEPS.map((step, i) => {
              const r = results[i];
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`rounded-3xl p-6 border ${glassCard}`}
                  style={glassStyle}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center border font-mono text-xs font-bold shrink-0 border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {step.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-sans font-semibold text-base mb-1 text-[var(--text)]">
                        {step.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                        {step.desc}
                      </p>
                    </div>
                    <button
                      onClick={runners[i]}
                      disabled={r.status === 'running'}
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all hover:scale-[1.02] disabled:opacity-40 bg-[var(--text)] text-[var(--bg)]"
                    >
                      <PlayCircle className="w-3 h-3" />
                      {r.status === 'running' ? 'Running…' : 'Run step'}
                    </button>
                  </div>

                  {r.status !== 'idle' && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`inline-flex items-center text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${statusStyle(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                        {r.error && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            {r.error}
                          </span>
                        )}
                      </div>
                      {r.data != null && (
                        <pre className="font-mono text-[11px] rounded-2xl p-4 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-center mt-8 text-[var(--text-muted)]">
            Maiat protocol · BSC testnet · Live API
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
