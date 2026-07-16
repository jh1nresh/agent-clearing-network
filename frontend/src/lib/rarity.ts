/**
 * Rarity System for Skill Cards
 *
 * Rarity is computed automatically based on installs + rating.
 * No manual override needed.
 */

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type Category =
  | "Security"
  | "DeFi"
  | "Trading"
  | "Content"
  | "Analytics"
  | "Infra"
  | "Social";

/**
 * Compute rarity based on installs and rating.
 *
 * | Rarity    | Condition                           |
 * |-----------|-------------------------------------|
 * | Legendary | installs > 2000 OR rating >= 4.9   |
 * | Epic      | installs > 500                     |
 * | Rare      | installs > 100                     |
 * | Common    | default                            |
 */
export function computeRarity(installs: number, rating: number): Rarity {
  if (installs > 2000 || rating >= 4.9) return "legendary";
  if (installs > 500) return "epic";
  if (installs > 100) return "rare";
  return "common";
}

/**
 * Rarity border colors (card edge glow)
 */
export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#b8a990", // gray-brown
  rare: "#4a90d9", // blue
  epic: "#9b59b6", // purple
  legendary: "#c9a84c", // gold
};

/**
 * Rarity text/badge colors for UI labels
 */
export const RARITY_TEXT_COLORS: Record<Rarity, string> = {
  common: "text-[#b8a990]",
  rare: "text-[#4a90d9]",
  epic: "text-[#9b59b6]",
  legendary: "text-[#c9a84c]",
};

/**
 * Rarity background colors for badges
 */
export const RARITY_BG_COLORS: Record<Rarity, string> = {
  common: "bg-[#b8a990]/10",
  rare: "bg-[#4a90d9]/10",
  epic: "bg-[#9b59b6]/10",
  legendary: "bg-[#c9a84c]/10",
};

/**
 * Category color bar colors
 */
export const CATEGORY_COLORS: Record<string, string> = {
  Security: "#8b1a1a", // deep red
  DeFi: "#1a5c8b", // deep blue
  Trading: "#1a6b3a", // deep green
  Content: "#6b3a8b", // deep purple
  Analytics: "#8b6b1a", // deep gold
  Infra: "#3a3a3a", // deep gray
  Social: "#5a3a6b", // muted purple
};

/**
 * Get category color, with fallback for unknown categories
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#3a3a3a";
}

/**
 * Rarity labels for display
 */
export const RARITY_LABELS: Record<Rarity, string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};
