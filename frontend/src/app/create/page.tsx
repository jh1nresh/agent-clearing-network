'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, Sparkles, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useAutoCreateUser } from '@/hooks/useAutoCreateUser';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';
import { parseSkillMd } from '@/lib/skill-md';

const CATEGORIES = ['Trading', 'Security', 'Content', 'DeFi', 'Analytics', 'Infra', 'Social'];

const EMOJI_OPTIONS = [
  '⚡', '🔍', '🛡️', '📊', '🎯', '🔒', '⛽', '🐦',
  '🤖', '💹', '🧠', '🔮', '🦅', '🥷', '💎', '🚀',
];

export default function CreateSkillPage() {
  const router = useRouter();
  const { ready, authenticated, login, user } = usePrivy();
  useAutoCreateUser();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    longDescription: '',
    category: 'Trading',
    icon: '⚡',
    price: '',
    tags: '',
    fileContent: '',
    fileType: 'markdown',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSkillMd, setShowSkillMd] = useState(false);
  const [skillMdRaw, setSkillMdRaw] = useState('');
  const [skillMdError, setSkillMdError] = useState<string | null>(null);

  const handleImportSkillMd = () => {
    setSkillMdError(null);
    try {
      const parsed = parseSkillMd(skillMdRaw);
      setFormData((prev) => ({
        ...prev,
        name: parsed.name,
        description: parsed.description,
        longDescription: parsed.longDescription ?? prev.longDescription,
        category: parsed.category,
        icon: parsed.icon ?? prev.icon,
        price: String(parsed.price),
        tags: parsed.tags,
        fileContent: parsed.fileContent,
        fileType: 'markdown',
      }));
      setShowSkillMd(false);
      setSkillMdRaw('');
    } catch (err) {
      setSkillMdError(
        err instanceof Error ? err.message : 'Invalid SkillMD format'
      );
    }
  };

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authenticated || !user) {
      setError('You must be signed in to create a skill.');
      return;
    }

    if (!formData.name.trim() || !formData.description.trim()) {
      setError('Name and description are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/skills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privyId: user.id,
          email: user.email?.address,
          walletAddress: user.wallet?.address,
          displayName: user.google?.name ?? user.email?.address?.split('@')[0],
          name: formData.name.trim(),
          description: formData.description.trim(),
          longDescription: formData.longDescription.trim() || undefined,
          category: formData.category,
          icon: formData.icon,
          price: parseFloat(formData.price) || 0,
          tags: formData.tags.trim(),
          fileContent: formData.fileContent.trim() || undefined,
          fileType: formData.fileType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create skill');
      }

      const skill = await response.json();
      router.push(`/skill/${skill.id}`);
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
                  Become a creator
                </span>
              </div>
              <h1 className="font-sans font-semibold text-4xl tracking-[-0.03em] leading-[1.05] mb-4 text-[var(--text)]">
                Publish a skill.
                <br />
                Earn on every call.
              </h1>
              <p className="text-sm mb-8 max-w-sm mx-auto leading-relaxed text-[var(--text-muted)]">
                Sign in to publish skills agents can buy. Settled on-chain via ERC-8183 escrow.
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
                Publish a skill
              </span>
            </div>
            <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] mb-5 text-[var(--text)]">
              Teach agents
              <br />
              new tricks.
            </h1>
            <p className="text-base max-w-xl text-[var(--text-muted)]">
              Define a skill, set a price per call, and ship. Agents discover it instantly,
              settlement is automatic on PASS.
            </p>
          </header>

          {/* SkillMD import */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowSkillMd((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
            >
              <FileText className="h-3 w-3" />
              {showSkillMd ? 'Hide SkillMD import' : 'Import from SkillMD'}
            </button>
            {showSkillMd && (
              <div
                className={`mt-4 rounded-3xl border p-6 ${glassCard}`}
                style={glassStyle}
              >
                <div className={labelClass}>Paste SkillMD</div>
                <p className="mb-3 text-[12px] text-[var(--text-muted)]">
                  Markdown file with YAML frontmatter. See{' '}
                  <a
                    href="https://github.com/JhiNResH/maiat-dojo/blob/main/examples/skill-template.md"
                    className="underline hover:text-[var(--text)]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    example
                  </a>
                  .
                </p>
                <textarea
                  value={skillMdRaw}
                  onChange={(e) => setSkillMdRaw(e.target.value)}
                  placeholder={`---\nname: My Skill\ndescription: …\ncategory: DeFi\nprice: 0.003\n---\n\n# Body content…`}
                  rows={10}
                  className={`${inputBase} resize-y font-mono text-[12px]`}
                />
                {skillMdError && (
                  <p className="mt-2 text-[12px] text-red-500">{skillMdError}</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImportSkillMd}
                    disabled={!skillMdRaw.trim()}
                    className="rounded-full bg-[var(--text)] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--bg)] disabled:opacity-40"
                  >
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkillMdRaw('');
                      setSkillMdError(null);
                    }}
                    className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basics card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>01 — Basics</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-6 text-[var(--text)]">
                What is the skill?
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Skill name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Token Price Oracle"
                    className={inputBase}
                    maxLength={100}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Short description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="One sentence. What does this skill do?"
                    rows={2}
                    className={`${inputBase} resize-none`}
                    maxLength={300}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Long description</label>
                  <textarea
                    name="longDescription"
                    value={formData.longDescription}
                    onChange={handleChange}
                    placeholder="Capabilities, use cases, how it works…"
                    rows={5}
                    className={`${inputBase} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className={`${inputBase} cursor-pointer`}
                    >
                      {CATEGORIES.map((cat) => (
                        <option
                          key={cat}
                          value={cat}
                          style={{ background: 'var(--bg)' }}
                        >
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <label className={labelClass}>Icon</label>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`${inputBase} text-left flex items-center gap-3`}
                    >
                      <span className="text-xl">{formData.icon}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        Click to change
                      </span>
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
                              setFormData((prev) => ({ ...prev, icon: emoji }));
                              setShowEmojiPicker(false);
                            }}
                            className={`text-xl p-2 rounded-xl transition-colors ${
                              formData.icon === emoji
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
              </div>
            </motion.section>

            {/* Pricing card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>02 — Pricing & discovery</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-6 text-[var(--text)]">
                Price per call & tags.
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Price (USDC)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-[var(--text-muted)]">
                      $
                    </span>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className={`${inputBase} pl-8 font-mono tabular-nums`}
                    />
                  </div>
                  <p className={helperClass}>
                    Settled in USDC on BNB Smart Chain. Leave 0 for free skills.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Tags</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="yield, defi, optimization, btc"
                    className={inputBase}
                  />
                  <p className={helperClass}>
                    Comma-separated keywords agents use to discover the skill.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* Instructions card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
              <div className={labelClass}>03 — Skill instructions</div>
              <h2 className="font-sans font-semibold text-xl tracking-[-0.02em] mb-6 text-[var(--text)]">
                What buyers receive.
              </h2>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Content type</label>
                  <select
                    name="fileType"
                    value={formData.fileType}
                    onChange={handleChange}
                    className={`${inputBase} cursor-pointer`}
                  >
                    <option value="markdown" style={{ background: 'var(--bg)' }}>
                      Markdown (.md)
                    </option>
                    <option value="json" style={{ background: 'var(--bg)' }}>
                      JSON
                    </option>
                    <option value="text" style={{ background: 'var(--bg)' }}>
                      Plain text
                    </option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Instructions</label>
                  <textarea
                    name="fileContent"
                    value={formData.fileContent}
                    onChange={handleChange}
                    placeholder={`# ${formData.name || 'Skill Name'}

## Overview
What this skill does and how an agent should use it.

## Instructions
Step-by-step instructions.

## Examples
\`\`\`
Example input/output pairs
\`\`\`

## Configuration
API keys or settings.`}
                    rows={14}
                    className={`${inputBase} font-mono text-xs resize-none`}
                  />
                  <p className={helperClass}>
                    Delivered to the buyer after each successful call.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* Submit card */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className={`rounded-3xl p-8 border ${glassCard}`}
              style={glassStyle}
            >
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
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Publish skill
                  </>
                )}
              </button>

              <p className="text-[10px] font-mono text-center mt-4 text-[var(--text-muted)]">
                By publishing, you agree to the Dojo creator terms.
              </p>
            </motion.section>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
