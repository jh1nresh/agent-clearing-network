"use client";

/**
 * SkillRankList — shared presentational list for Leaderboard / Trending.
 *
 * Rendered inside a glass-card with clean sans-serif typography.
 * Metric is whatever the parent wants to show (trust score, recent calls,
 * pricePerCall). Keeps the component generic.
 */

import Link from "next/link";
import type { ChatSkillSummary } from "../chat/types";

export interface SkillRankItem extends ChatSkillSummary {
  recentSessions?: number;
  recentCalls?: number;
}

export interface SkillRankListProps {
  label: string;
  meta?: string;
  skills: SkillRankItem[] | null; // null = loading, [] = empty
  emptyCopy: string;
  /** pull metric for the right column off the row (e.g. trust score, calls) */
  metric: (s: SkillRankItem) => string;
}

export function SkillRankList({
  label,
  meta,
  skills,
  emptyCopy,
  metric,
}: SkillRankListProps) {
  return (
    <section className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-sm">{label}</span>
        {meta && (
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {meta}
          </span>
        )}
      </div>
      {skills === null ? (
        <p className="text-[13px] text-[var(--text-muted)]">Loading&hellip;</p>
      ) : skills.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">{emptyCopy}</p>
      ) : (
        <ul>
          {skills.map((s, i) => (
            <li
              key={s.id}
              className="border-b border-[var(--border-light)] py-2.5 last:border-b-0"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[13px] font-bold leading-none text-[var(--text-muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/skill/${s.id}`}
                    className="inline-block max-w-full truncate text-[13px] font-semibold leading-tight text-[var(--text)] transition-colors hover:text-[var(--text-secondary)]"
                  >
                    {s.name}
                  </Link>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                      {s.category ?? "misc"}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                      {metric(s)}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SkillRankList;
