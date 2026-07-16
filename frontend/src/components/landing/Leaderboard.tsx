"use client";

/**
 * Leaderboard — top skills by on-chain trust score.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (landing hero §Leaderboard+Trending)
 *
 * "Trust" is cumulative quality: evaluationScore on Skill, derived from BAS
 * attestations per session. Sort is DESC; nulls naturally sink. Zero-state
 * copy hints at the seed flow so a fresh DB still feels intentional.
 */

import { useEffect, useState } from "react";
import { SkillRankList, type SkillRankItem } from "./SkillRankList";

export function Leaderboard({ limit = 5 }: { limit?: number }) {
  const [skills, setSkills] = useState<SkillRankItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/skills?sort=trust&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSkills(data.skills ?? []);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <SkillRankList
      label="Leaderboard"
      meta="by trust"
      skills={skills}
      emptyCopy="No skills listed yet."
      metric={(s) => {
        const score = s.trustScore ?? 0;
        return score > 0 ? `${Math.round(score)}★` : "—";
      }}
    />
  );
}

export default Leaderboard;
