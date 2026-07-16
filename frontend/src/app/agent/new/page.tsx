'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useAutoCreateUser } from '@/hooks/useAutoCreateUser';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';

const EMOJI_OPTIONS = [
  '⚡', '🔍', '🛡️', '📊', '🎯', '🔒', '⛽', '🐦',
  '🤖', '💹', '🧠', '🔮', '🦅', '🥷', '💎', '🚀',
];

interface SkillItem {
  id: string;
  name: string;
  icon: string;
  category: string;
  price: number;
}

export default function NewAgentPage() {
  const router = useRouter();
  const { ready, authenticated, login, user } = usePrivy();
  useAutoCreateUser();

  const [formData, setFormData] = useState({ name: '', description: '', avatar: '🤖' });
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const glassCard = 'border border-[var(--border)] bg-[var(--card-bg)]';

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  } as const;

  const inputBase =
    'w-full bg-transparent border rounded-2xl px-4 py-3 font-sans text-sm focus:outline-none transition-colors placeholder:opacity-30 border-[var(--border)] text-[var(--text)] focus:border-[var(--text-secondary)] placeholder:text-[var(--text)]';

  const labelClass =
    'block text-[10px] font-bold uppercase tracking-[0.2em] mb-2 text-[var(--text-muted)]';

  const helperClass = 'text-[10px] font-mono mt-2 text-[var(--text-muted)]';

  useEffect(() => {
    fetch('/api/skills?sort=popular&limit=20')
      .then((r) => r.json())
      .then((data) => setSkills(data.skills ?? []))
      .catch(() => {});
  }, []);

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authenticated || !user) {
      setError('You must be signed in to create an agent.');
      return;
    }

    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Name and description are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: user.id,
          email: user.email?.address,
          walletAddress: user.wallet?.address,
          displayName: user.google?.name ?? user.email?.address?.split('@')[0],
          agent: {
            name: formData.name.trim(),
            description: formData.description.trim(),
            avatar: formData.avatar,
            skillIds: [...selectedSkillIds],
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create agent');
      }

      const result = await response.json();
      router.push('/agent/' + result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Login prompt
  if (ready && !authenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
        <BackgroundEffect />
        <Navbar />
        <main className="relative pt-32 pb-20 px-6">
          <div className="max-w-xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={`rounded-3xl p-12 border ${glassCard}`}
              style={glassStyle}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6 border-[var(--border)] bg-[var(--card-bg)]">
                <Sparkles className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Deploy an agent
                </span>
              </div>
              <h1 className="font-sans font-semibold text-4xl tracking-[-0.03em] leading-[1.05] mb-4 text-[var(--text)]">
                Build an agent.
                <br />
                Equip it with skills.
              </h1>
              <p className="text-sm mb-8 max-w-sm mx-auto leading-relaxed text-[var(--text-muted)]">
                Sign in to create an agent, equip it with skills, and put it to work. Reputation tracked on-chain via BAS.
              </p>
              <button
                onClick={login}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-all hover:scale-[1.02] bg-[var(--text)] text-[var(--bg)]"
              >
                Sign in to continue
              </button>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
      <BackgroundEffect />
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 transition-opacity hover:opacity-70 text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to marketplace
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5 border-[var(--border)] bg-[var(--card-bg)]">
              <Sparkles className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                Deploy an agent
              </span>
            </div>
            <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] mb-5 text-[var(--text)]">
              Build an agent.
              <br />
              Equip it with skills.
            </h1>
            <p className="text-base max-w-xl text-[var(--text-muted)]">
              Name your agent, give it a purpose, and equip it with skills from the marketplace. Reputation tracks on-chain every call.
            </p>
          </header>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Identity card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>01 — Identity</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-6 text-[var(--text)]">
                Who is this agent?
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Agent name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Alpha Scout"
                    className={inputBase}
                    maxLength={80}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="What does this agent do? What is its purpose?"
                    rows={3}
                    className={`${inputBase} resize-none`}
                    maxLength={300}
                    required
                  />
                  <p className={helperClass}>{formData.description.length}/300 characters</p>
                </div>

                <div className="relative">
                  <label className={labelClass}>Avatar</label>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`${inputBase} text-left flex items-center gap-3`}
                  >
                    <span className="text-xl">{formData.avatar}</span>
                    <span className="text-xs text-[var(--text-muted)]">Click to change</span>
                  </button>
                  {showEmojiPicker && (
                    <div
                      className={`absolute top-full left-0 right-0 mt-2 rounded-2xl border p-3 grid grid-cols-8 gap-1 z-20 ${glassCard}`}
                      style={glassStyle}
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, avatar: emoji }));
                            setShowEmojiPicker(false);
                          }}
                          className={`text-xl p-2 rounded-xl transition-colors ${
                            formData.avatar === emoji
                              ? 'bg-[var(--bg-secondary)]'
                              : 'hover:bg-[var(--bg-secondary)]'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.section>

            {/* Equip skills card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>02 — Equip skills</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-2 text-[var(--text)]">
                What can it do?
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                Select one or more skills to equip. You can add more later.
              </p>

              {skills.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">Loading skills…</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {skills.map((skill) => {
                    const selected = selectedSkillIds.has(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        className={`rounded-2xl p-4 border text-left transition-colors ${
                          selected
                            ? 'border-[var(--text)] bg-[var(--bg-secondary)]'
                            : 'border-[var(--border)] hover:border-[var(--text-secondary)]'
                        }`}
                      >
                        <div className="text-2xl mb-2">{skill.icon}</div>
                        <div className="text-xs font-semibold leading-tight mb-1 text-[var(--text)]">
                          {skill.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mb-2">
                          {skill.category}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-[var(--text-muted)]">
                          {skill.price === 0 ? 'Free' : `$${skill.price.toFixed(3)}/call`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSkillIds.size > 0 && (
                <p className={`${helperClass} mt-4`}>
                  {selectedSkillIds.size} skill{selectedSkillIds.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </motion.section>

            {/* Confirm & launch card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>03 — Confirm & launch</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-6 text-[var(--text)]">
                Ready to deploy?
              </h2>

              {error && (
                <div className="mb-6 p-4 rounded-2xl border text-xs font-mono border-[var(--error)]/20 bg-[var(--error)]/5 text-[var(--error)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-3 px-7 py-4 rounded-full text-xs font-bold uppercase tracking-[0.15em] transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-[var(--text)] text-[var(--bg)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <Bot className="w-3.5 h-3.5" />
                    Launch agent
                  </>
                )}
              </button>

              <p className="text-[10px] font-mono text-center mt-4 text-[var(--text-muted)]">
                Agent reputation tracks on-chain via BAS attestations.
              </p>
            </motion.section>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
