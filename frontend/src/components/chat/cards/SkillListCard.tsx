"use client";

/**
 * SkillListCard — chat-embedded mini browse view.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (buyer intent: list / show skills)
 *
 * Two-line rhythm per row:
 *   ── 01 ─────────────────────── $0.005 ──
 *   Token Price Oracle                  [Run]
 *   Real-time BNB, ETH, BTC price feed…
 *   ORACLE · 142 calls
 *
 * - Title links to `/skill/[id]` (chat ↔ URL duality, invariant #2).
 * - "Run" opens the SkillExecutor inline as a new chat message.
 */

import Link from "next/link";
import type { ChatSkillSummary } from "../types";

export interface SkillListCardProps {
  skills: ChatSkillSummary[];
  onRun?: (skill: ChatSkillSummary) => void;
}

export function SkillListCard({ skills, onRun }: SkillListCardProps) {
  if (skills.length === 0) {
    return (
      <div
        className="border border-dashed bg-[#f8f5ef]/60 px-4 py-6 text-center font-serif text-sm italic text-[#1a1a1a]/40"
        style={{ borderColor: "#b8a990" }}
      >
        No skills listed yet.
      </div>
    );
  }

  return (
    <figure className="my-1">
      <figcaption className="mb-2 flex items-baseline justify-between border-b-[3px] border-double border-[#1a1a1a]/60 pb-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/70">
          Skill Listings
        </span>
        <span className="font-mono text-[9px] text-[#1a1a1a]/30">
          {skills.length} on offer
        </span>
      </figcaption>

      <ul>
        {skills.map((skill, i) => (
          <li
            key={skill.id}
            className="border-b border-dotted border-[#1a1a1a]/20 py-3 last:border-b-0"
          >
            <div className="flex items-start gap-4">
              <span className="w-6 shrink-0 pt-1 text-right font-serif text-[22px] font-black leading-none text-[#1a1a1a]/15">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-baseline justify-between gap-3">
                  <Link
                    href={`/skill/${skill.id}`}
                    className="truncate font-serif text-[17px] font-bold leading-snug text-[#1a1a1a] hover:underline"
                  >
                    {skill.name}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-[#1a1a1a]">
                    {skill.pricePerCall != null && skill.pricePerCall > 0
                      ? `$${skill.pricePerCall.toFixed(3)}`
                      : "FREE"}
                    <span className="ml-0.5 font-normal text-[#1a1a1a]/30">
                      /call
                    </span>
                  </span>
                </div>

                {skill.description && (
                  <p className="mb-1.5 font-serif text-[13px] leading-snug text-[#1a1a1a]/55 line-clamp-2">
                    {skill.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/40">
                    {skill.category && <span>{skill.category}</span>}
                    {typeof skill.callCount === "number" && (
                      <>
                        {skill.category && <span className="text-[#1a1a1a]/15">·</span>}
                        <span>{skill.callCount} calls</span>
                      </>
                    )}
                  </div>
                  {onRun && (
                    <button
                      onClick={() => onRun(skill)}
                      className="border border-[#1a1a1a] bg-transparent px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a] transition hover:bg-[#1a1a1a] hover:text-[#f0ece2]"
                    >
                      Run →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-2 text-right font-mono text-[9px] text-[#1a1a1a]/30">
        or type{" "}
        <span className="text-[#b08d57]/70">call &lt;name&gt;</span> to sandbox
      </div>
    </figure>
  );
}

export default SkillListCard;
