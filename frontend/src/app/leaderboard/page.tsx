'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, TrendingUp, Users } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { BackgroundEffect } from '@/components/landing/BackgroundEffect';

type Skill = {
  id: string;
  name: string;
  icon: string;
  category: string;
  installs: number;
  rating: number;
  price: number;
  creator: {
    id: string;
    displayName: string | null;
  };
};

type Creator = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalSales: number;
  totalRevenue: number;
  avgRating: number;
  skillCount: number;
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'skills' | 'creators'>('skills');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'skills') {
          const res = await fetch('/api/skills?sort=popular&limit=50');
          const data = await res.json();
          setSkills(data.skills || []);
        } else {
          const res = await fetch('/api/leaderboard?type=creators&limit=50');
          const data = await res.json();
          setCreators(data.creators || []);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard data:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [activeTab]);

  const glassCard = 'border border-[var(--border)] bg-[var(--card-bg)]';

  const glassStyle = {
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  } as const;

  const headerCellClass = 'text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]';

  const rowDivider = 'border-[var(--border)]';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-700">
      <BackgroundEffect />
      <Navbar />

      <main className="relative pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 transition-opacity hover:opacity-70 text-[var(--text-muted)]"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to marketplace
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)] mb-5">
              <Trophy className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">
                Leaderboard
              </span>
            </div>
            <h1 className="font-sans font-semibold text-4xl md:text-6xl tracking-[-0.03em] leading-[0.95] mb-5 text-[var(--text)]">
              Real ones rise.
            </h1>
            <p className="text-base max-w-xl text-[var(--text-muted)]">
              Sorted by on-chain data. No paid rankings, no promoted slots, no recency tricks.
            </p>
          </header>

          {/* Tabs */}
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-full border mb-8 ${glassCard}`}
            style={glassStyle}
          >
            <button
              onClick={() => setActiveTab('skills')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                activeTab === 'skills'
                  ? 'bg-[var(--text)] text-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Skills
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                activeTab === 'creators'
                  ? 'bg-[var(--text)] text-[var(--bg)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Users className="w-3 h-3" />
              Creators
            </button>
          </div>

          {/* Table card */}
          <motion.section
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`rounded-3xl p-2 border overflow-hidden ${glassCard}`}
            style={glassStyle}
          >
            {loading ? (
              <div className="text-center py-16">
                <p className="font-mono text-xs uppercase tracking-[0.2em] animate-pulse text-[var(--text-muted)]">
                  Loading rankings…
                </p>
              </div>
            ) : activeTab === 'skills' ? (
              <div>
                <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b ${rowDivider}`}>
                  <div className={`col-span-1 text-right ${headerCellClass}`}>Rank</div>
                  <div className={`col-span-4 ${headerCellClass}`}>Skill</div>
                  <div className={`col-span-2 ${headerCellClass}`}>Category</div>
                  <div className={`col-span-2 text-right ${headerCellClass}`}>Installs</div>
                  <div className={`col-span-1 text-right ${headerCellClass}`}>Rating</div>
                  <div className={`col-span-2 text-right ${headerCellClass}`}>Price</div>
                </div>

                {skills.length === 0 ? (
                  <p className="text-center py-12 text-sm italic text-[var(--text-muted)]">
                    No skills found.
                  </p>
                ) : (
                  skills.map((skill, index) => (
                    <Link
                      key={skill.id}
                      href={`/skill/${skill.id}`}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 border-b last:border-b-0 transition-colors items-center group ${rowDivider} hover:bg-[var(--bg-secondary)]`}
                    >
                      <div className="col-span-1 text-right">
                        <span
                          className={`font-mono text-base font-bold tabular-nums ${
                            index < 3 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{skill.icon}</span>
                        <div className="min-w-0">
                          <div className="font-sans font-semibold text-sm truncate text-[var(--text)]">
                            {skill.name}
                          </div>
                          <div className="font-mono text-[10px] truncate text-[var(--text-muted)]">
                            by {skill.creator?.displayName || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                          {skill.category}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--text)]">
                          {skill.installs.toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                          {skill.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--text)]">
                          {skill.price === 0 ? 'FREE' : `$${skill.price.toFixed(2)}`}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            ) : (
              <div>
                <div className={`grid grid-cols-12 gap-4 px-6 py-4 border-b ${rowDivider}`}>
                  <div className={`col-span-1 text-right ${headerCellClass}`}>Rank</div>
                  <div className={`col-span-4 ${headerCellClass}`}>Creator</div>
                  <div className={`col-span-2 text-right ${headerCellClass}`}>Sales</div>
                  <div className={`col-span-2 text-right ${headerCellClass}`}>Revenue</div>
                  <div className={`col-span-1 text-right ${headerCellClass}`}>Rating</div>
                  <div className={`col-span-2 text-right ${headerCellClass}`}>Skills</div>
                </div>

                {creators.length === 0 ? (
                  <p className="text-center py-12 text-sm italic text-[var(--text-muted)]">
                    No creators found.
                  </p>
                ) : (
                  creators.map((creator, index) => (
                    <Link
                      key={creator.id}
                      href={`/creator/${creator.id}`}
                      className={`grid grid-cols-12 gap-4 px-6 py-4 border-b last:border-b-0 transition-colors items-center group ${rowDivider} hover:bg-[var(--bg-secondary)]`}
                    >
                      <div className="col-span-1 text-right">
                        <span
                          className={`font-mono text-base font-bold tabular-nums ${
                            index < 3 ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[var(--bg-secondary)] text-[var(--text)]">
                          {(creator.displayName || '?')[0].toUpperCase()}
                        </div>
                        <div className="font-sans font-semibold text-sm truncate text-[var(--text)]">
                          {creator.displayName || 'Anonymous'}
                        </div>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--text)]">
                          {creator.totalSales.toLocaleString()}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm font-bold tabular-nums text-[var(--text)]">
                          ${creator.totalRevenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                          {creator.avgRating.toFixed(1)}
                        </span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-mono text-sm tabular-nums text-[var(--text-muted)]">
                          {creator.skillCount}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            )}
          </motion.section>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-center mt-6 text-[var(--text-muted)]">
            Rankings updated in real time · No pay-to-play
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
