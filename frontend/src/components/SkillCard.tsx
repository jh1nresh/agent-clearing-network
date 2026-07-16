"use client";

import Link from "next/link";
import {
  computeRarity,
  RARITY_COLORS,
  RARITY_LABELS,
  type Rarity,
} from "@/lib/rarity";

export interface SkillCardData {
  id: string;
  name: string;
  icon: string;
  category: string;
  rating: number;
  installs: number;
  price: number;
  description?: string;
}

interface SkillCardProps {
  skill: SkillCardData;
  size?: "sm" | "md" | "lg";
  showPrice?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    card: "p-2",
    icon: "text-xl",
    name: "text-xs leading-tight",
    categoryBar: "h-1 mt-1.5",
    categoryText: "text-[8px] mt-0.5",
    stats: "text-[8px] mt-1",
    price: "text-[10px]",
    badge: "text-[6px] px-1 py-0.5 mt-1",
    borderWidth: "2px",
  },
  md: {
    card: "w-40 p-3",
    icon: "text-3xl",
    name: "text-sm leading-tight",
    categoryBar: "h-1.5 mt-2",
    categoryText: "text-[9px] mt-1",
    stats: "text-[10px] mt-1.5",
    price: "text-xs",
    badge: "text-[7px] px-1.5 py-0.5 mt-1.5",
    borderWidth: "3px",
  },
  lg: {
    card: "w-52 p-4",
    icon: "text-4xl",
    name: "text-base leading-tight",
    categoryBar: "h-2 mt-3",
    categoryText: "text-[10px] mt-1",
    stats: "text-xs mt-2",
    price: "text-sm",
    badge: "text-[8px] px-2 py-1 mt-2",
    borderWidth: "4px",
  },
};

export function SkillCard({
  skill,
  size = "md",
  showPrice = true,
  onClick,
  href,
  className = "",
}: SkillCardProps) {
  const rarity: Rarity = computeRarity(skill.installs, skill.rating);
  const rarityColor = RARITY_COLORS[rarity];
  const config = SIZE_CONFIG[size];

  const isLegendary = rarity === "legendary";

  const cardContent = (
    <div
      className={`
        relative bg-[var(--card-bg)] border border-[var(--card-border)] transition-all duration-200
        hover:scale-[1.02] hover:shadow-lg
        ${config.card} ${className}
        ${isLegendary ? "legendary-shimmer" : ""}
      `}
      style={{
        borderTop: `3px solid ${rarity === "common" ? "var(--border)" : rarityColor}`,
        boxShadow: isLegendary
          ? `0 0 8px ${rarityColor}30`
          : `0 1px 3px rgba(0,0,0,0.04)`,
      }}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={`${config.icon} text-center`}>{skill.icon}</div>

      {/* Name */}
      <h3
        className={`font-mono font-bold text-[var(--text)] text-center ${config.name}`}
      >
        {skill.name}
      </h3>

      {/* Category bar */}
      <div
        className={`w-full bg-[var(--border)] ${config.categoryBar}`}
      />
      <p
        className={`font-mono uppercase tracking-wider text-center text-[var(--text-muted)] ${config.categoryText}`}
      >
        {skill.category}
      </p>

      {/* Rating + installs */}
      <div
        className={`font-mono text-[var(--text-muted)] text-center ${config.stats}`}
      >
        <span className="text-[var(--text-secondary)]">★ {skill.rating.toFixed(1)}</span>
        <span className="mx-1">·</span>
        <span>{skill.installs.toLocaleString()}</span>
      </div>

      {/* Price */}
      {showPrice && (
        <p
          className={`font-mono font-bold text-center text-[var(--text)] ${config.price}`}
        >
          {skill.price === 0 ? "FREE" : `$${skill.price.toFixed(0)}`}
        </p>
      )}

      {/* Rarity badge — ink style, color only for legendary */}
      <div
        className={`font-mono font-bold uppercase tracking-wider text-center ${config.badge}`}
        style={{
          color: rarity === "legendary" ? rarityColor : "var(--text)",
          opacity: rarity === "common" ? 0.35 : 0.7,
        }}
      >
        {RARITY_LABELS[rarity]}
      </div>

      {/* Legendary shimmer overlay */}
      {isLegendary && (
        <div
          className="absolute inset-0 pointer-events-none legendary-shimmer-overlay"
          style={{
            background: `linear-gradient(
              135deg,
              transparent 30%,
              ${rarityColor}15 45%,
              ${rarityColor}25 50%,
              ${rarityColor}15 55%,
              transparent 70%
            )`,
            backgroundSize: "200% 200%",
          }}
        />
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

// --- Card Grid Component ---
interface SkillCardGridProps {
  skills: SkillCardData[];
  size?: "sm" | "md" | "lg";
  showPrice?: boolean;
  className?: string;
}

export function SkillCardGrid({
  skills,
  size = "md",
  showPrice = true,
  className = "",
}: SkillCardGridProps) {
  const gridCols = {
    sm: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8",
    md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    lg: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className={`grid gap-3 ${gridCols[size]} ${className}`}>
      {skills.map((skill) => (
        <SkillCard
          key={skill.id}
          skill={skill}
          size={size}
          showPrice={showPrice}
          href={`/skill/${skill.id}`}
        />
      ))}
    </div>
  );
}

export default SkillCard;
