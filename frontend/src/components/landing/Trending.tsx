"use client";

/**
 * Trending — top skills by recent session volume (last 7 days).
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (landing hero §Leaderboard+Trending)
 *
 * "Trending" is motion: groupBy Session.openedAt within the window, sum
 * callCount. Distinct from Leaderboard (cumulative trust). Zero-state falls
 * back to newest listings server-side so this component always renders a
 * non-empty list when any skill exists.
 */

import { useEffect, useState } from "react";
import { SkillRankList, type SkillRankItem } from "./SkillRankList";

interface TrendingResponse {
  zeroState: boolean;
  skills: SkillRankItem[];
}

export function Trending({ limit = 5 }: { limit?: number }) {
  const [skills, setSkills] = useState<SkillRankItem[] | null>(null);
  const [zeroState, setZeroState] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/skills/trending?limit=${limit}&days=7`)
      .then((r) => r.json())
      .then((data: TrendingResponse) => {
        if (cancelled) return;
        setSkills(data.skills ?? []);
        setZeroState(data.zeroState ?? false);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const meta = zeroState ? "fresh listings" : "7d";

  return (
    <SkillRankList
      label="Trending"
      meta={meta}
      skills={skills}
      emptyCopy="No sessions this week — first mover awaits."
      metric={(s) => {
        if (zeroState) {
          // Show price in fallback mode — trend metric is meaningless pre-launch
          return s.pricePerCall != null && s.pricePerCall > 0
            ? `$${s.pricePerCall.toFixed(3)}`
            : "FREE";
        }
        const calls = s.recentCalls ?? 0;
        return calls > 0 ? `${calls} call${calls === 1 ? "" : "s"}` : "—";
      }}
    />
  );
}

export default Trending;
