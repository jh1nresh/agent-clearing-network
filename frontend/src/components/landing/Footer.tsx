'use client';

import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';
import { useDarkMode } from '@/app/DarkModeContext';

export function Footer() {
  const { isDark } = useDarkMode();

  return (
    <footer
      className={`pt-32 pb-12 px-8 border-t bg-[var(--bg)] ${
        isDark ? 'border-white/10' : 'border-[#1a1a1a]/15'
      }`}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-16 mb-32">
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-8">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                isDark ? 'bg-white text-black' : 'bg-black text-white'
              }`}
            >
              D
            </div>
            <span
              className={`font-mono font-bold text-base tracking-widest ${
                isDark ? 'text-white' : 'text-[#1a1a1a]'
              }`}
            >
              The Dojo
            </span>
          </div>
          <p className={`mb-8 max-w-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-[#1a1a1a]/50'}`}>
            The skill marketplace for AI agents. On-chain trust, paid per call.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://twitter.com/0xmaiat"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-full border transition-opacity hover:opacity-70 ${
                isDark ? 'border-white/10 text-gray-400' : 'border-[#1a1a1a]/10 text-[#1a1a1a]/50'
              }`}
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/JhiNResH/maiat-dojo"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-full border transition-opacity hover:opacity-70 ${
                isDark ? 'border-white/10 text-gray-400' : 'border-[#1a1a1a]/10 text-[#1a1a1a]/50'
              }`}
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <h4
            className={`font-mono text-[9px] uppercase tracking-[0.15em] mb-8 ${
              isDark ? 'text-white' : 'text-[#1a1a1a]'
            }`}
          >
            Marketplace
          </h4>
          <ul className={`space-y-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-[#1a1a1a]/50'}`}>
            <li>
              <Link href="/" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#1a1a1a]'}`}>
                Browse skills
              </Link>
            </li>
            <li>
              <Link
                href="/leaderboard"
                className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#1a1a1a]'}`}
              >
                Leaderboard
              </Link>
            </li>
            <li>
              <Link
                href="/create"
                className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#1a1a1a]'}`}
              >
                List a skill
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4
            className={`font-mono text-[9px] uppercase tracking-[0.15em] mb-8 ${
              isDark ? 'text-white' : 'text-[#1a1a1a]'
            }`}
          >
            Developers
          </h4>
          <ul className={`space-y-4 text-sm font-medium ${isDark ? 'text-gray-400' : 'text-[#1a1a1a]/50'}`}>
            <li>
              <a
                href="https://github.com/JhiNResH/maiat-dojo"
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#1a1a1a]'}`}
              >
                GitHub
              </a>
            </li>
            <li>
              <Link
                href="/demo"
                className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-[#1a1a1a]'}`}
              >
                Demo
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4
            className={`font-mono text-[9px] uppercase tracking-[0.15em] mb-8 ${
              isDark ? 'text-white' : 'text-[#1a1a1a]'
            }`}
          >
            Trust layer
          </h4>
          <p className={`text-sm leading-relaxed mb-6 ${isDark ? 'text-gray-400' : 'text-[#1a1a1a]/50'}`}>
            Every skill call settles on BSC. Trust scores are public and on-chain.
          </p>
          <a
            href="https://maiat.io"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium border transition-opacity hover:opacity-70 w-full ${
              isDark
                ? 'text-white border-white/20 bg-white/5'
                : 'text-[#1a1a1a] border-[#1a1a1a]/10'
            }`}
          >
            Maiat Protocol
          </a>
        </div>
      </div>

      <div
        className={`max-w-7xl mx-auto pt-12 border-t flex flex-col md:flex-row items-center justify-between font-mono text-[9px] uppercase tracking-[0.15em] gap-6 ${
          isDark ? 'border-white/10 text-gray-600' : 'border-[#1a1a1a]/10 text-[#1a1a1a]/40'
        }`}
      >
        <p>© 2026 The Dojo · Maiat Protocol · BSC</p>
        <div className="flex items-center gap-4">
          <span>MIT License</span>
          <a
            href="https://github.com/JhiNResH/maiat-dojo"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-70"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
