'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { LogIn, Moon, Sun, User } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useDarkMode } from '@/app/DarkModeContext';

type DockLink = { label: string; href: string };

const DOCK_LINKS: DockLink[] = [
  { label: 'Browse', href: '/' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Create', href: '/create' },
  { label: 'Dashboard', href: '/dashboard' },
];

function DockItem({
  item,
  mouseX,
}: {
  item: DockLink;
  mouseX: ReturnType<typeof useMotionValue<number>>;
}) {
  const { isDark } = useDarkMode();
  const ref = useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });
  const scale = useTransform(distance, [-120, 0, 120], [1, 1.35, 1]);
  const springScale = useSpring(scale, { mass: 0.1, stiffness: 200, damping: 12 });

  return (
    <Link ref={ref} href={item.href} className="relative no-underline">
      <motion.div style={{ scale: springScale }} className="px-5 py-2 rounded-full">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'
          }`}
        >
          {item.label}
        </span>
      </motion.div>
    </Link>
  );
}

function AuthPill() {
  const { isDark } = useDarkMode();
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return null;

  if (authenticated && user) {
    const displayName =
      user.email?.address?.split('@')[0] ||
      user.google?.name ||
      (user.wallet?.address
        ? user.wallet.address.slice(0, 6) + '…' + user.wallet.address.slice(-4)
        : 'Agent');

    return (
      <div className="flex items-center gap-2">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            isDark
              ? 'border-white/10 bg-white/5 text-white'
              : 'border-black/5 bg-black/5 text-black'
          }`}
        >
          <User className="w-3 h-3" />
          {displayName}
        </div>
        <button
          onClick={logout}
          className={`text-[10px] font-bold uppercase tracking-widest hover:opacity-70 transition-opacity ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-lg inline-flex items-center gap-2 ${
        isDark ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      <LogIn className="w-3 h-3" />
      Connect
    </button>
  );
}

export function Navbar() {
  const { isDark, toggleDark } = useDarkMode();
  const mouseX = useMotionValue(-Infinity);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setNavVisible(currentY < 50 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, x: '-50%', opacity: 0 }}
      animate={{ y: navVisible ? 0 : -100, x: '-50%', opacity: navVisible ? 1 : 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-6 left-1/2 z-50 w-[95%] max-w-5xl rounded-full px-6 py-3 flex items-center justify-between border transition-all duration-500 ${
        isDark
          ? 'bg-white/5 border-white/[0.08] shadow-[inset_0_0_30px_rgba(255,255,255,0.02),0_30px_100px_rgba(0,0,0,0.3)]'
          : 'bg-white/70 border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.05)]'
      }`}
      style={{
        backdropFilter: 'blur(60px) saturate(180%)',
        WebkitBackdropFilter: 'blur(60px) saturate(180%)',
      }}
    >
      <Link href="/" className="flex items-center gap-2.5 group cursor-pointer shrink-0 no-underline">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-[9px] font-bold ${
            isDark ? 'bg-white text-black' : 'bg-black text-white'
          }`}
        >
          道
        </div>
        <span
          className={`font-mono font-bold text-base tracking-widest ${
            isDark ? 'text-white' : 'text-black'
          }`}
        >
          dojo
        </span>
      </Link>

      <motion.div
        className="hidden md:flex items-center gap-0.5"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(-Infinity)}
      >
        {DOCK_LINKS.map((item) => (
          <DockItem key={item.label} item={item} mouseX={mouseX} />
        ))}
      </motion.div>

      <div className="flex items-center gap-3">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
            isDark ? 'border-white/10 text-gray-400' : 'border-black/[0.08] text-gray-500'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${isDark ? 'bg-white' : 'bg-black'}`} />
          Live on BSC
        </div>
        <button
          onClick={toggleDark}
          aria-label="Toggle theme"
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
            isDark
              ? 'bg-white/10 border-white/10 text-yellow-400'
              : 'bg-black/5 border-black/5 text-gray-500'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <AuthPill />
      </div>
    </motion.nav>
  );
}
