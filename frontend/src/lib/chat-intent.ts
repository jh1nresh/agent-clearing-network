/**
 * Chat intent parser — pure function, no React, no fetch.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (Chat UI > Intent Detection)
 *
 * Phase 1 supports 5 buyer intents:
 *   1. help        — show command list
 *   2. list-skills — render SkillListCard
 *   3. call-skill  — find skill, render <SkillExecutor> in chat
 *   4. my-sessions — Phase 2 placeholder
 *   5. close-session — Phase 2 placeholder
 *
 * Anything else → unknown (Dojo politely asks for clarification).
 *
 * Test invariant: this module must stay pure so we can move it server-side
 * later (e.g. for an LLM-assisted intent router) without dragging UI deps.
 */

export type ChatIntent =
  | { kind: 'help' }
  | { kind: 'publish' }
  | { kind: 'list-skills'; query?: string }
  | { kind: 'call-skill'; query: string }
  | { kind: 'my-sessions' }
  | { kind: 'close-session'; sessionId?: string }
  | { kind: 'unknown'; raw: string };

const HELP_RX = /^\s*(help|\?|\/help|commands?|what can you do)\s*$/i;
const PUBLISH_RX = /^\s*(publish|add\s+skill|create\s+skill|new\s+skill)\s*$/i;
const LIST_RX =
  /^\s*(list|show|browse|see|view)?\s*(all\s+)?skills?\s*$/i;
const LIST_FUZZY_RX = /^\s*(list|browse)\s*$/i;
const SESSIONS_RX = /^\s*(my\s+sessions?|sessions?)\s*$/i;
const CLOSE_RX = /^\s*close\s+session\s*([\w-]*)\s*$/i;

const CALL_PREFIX_RX = /^\s*(call|run|use|test|try)\s+(.+)\s*$/i;
const PRICE_OF_RX = /^\s*price\s+of\s+(.+)\s*$/i;
const TRAILING_PRICE_RX = /^\s*(.+?)\s+price\s*$/i;
const ECHO_RX = /^\s*echo(\s+.+)?\s*$/i;

export function parseChatIntent(raw: string): ChatIntent {
  const text = raw.trim();
  if (text.length === 0) return { kind: 'unknown', raw };

  if (HELP_RX.test(text)) return { kind: 'help' };

  if (PUBLISH_RX.test(text)) return { kind: 'publish' };

  if (LIST_RX.test(text) || LIST_FUZZY_RX.test(text)) {
    return { kind: 'list-skills' };
  }

  const closeMatch = text.match(CLOSE_RX);
  if (closeMatch) {
    return {
      kind: 'close-session',
      sessionId: closeMatch[1] || undefined,
    };
  }

  if (SESSIONS_RX.test(text)) return { kind: 'my-sessions' };

  // call <something>
  const callMatch = text.match(CALL_PREFIX_RX);
  if (callMatch) return { kind: 'call-skill', query: callMatch[2].trim() };

  // price of BTC → call-skill targeting price oracle
  const priceMatch = text.match(PRICE_OF_RX);
  if (priceMatch) {
    return { kind: 'call-skill', query: `price ${priceMatch[1].trim()}` };
  }

  // BTC price → same
  const trailingMatch = text.match(TRAILING_PRICE_RX);
  if (trailingMatch && !/skills?$/i.test(trailingMatch[1])) {
    return { kind: 'call-skill', query: `price ${trailingMatch[1].trim()}` };
  }

  // bare "echo" or "echo hello" → call echo skill
  if (ECHO_RX.test(text)) return { kind: 'call-skill', query: 'echo' };

  return { kind: 'unknown', raw };
}

/**
 * Score-based skill matcher. Returns the best skill for an intent query
 * or null if nothing scores above the threshold.
 *
 * Used by ChatRoom after parseChatIntent returns a `call-skill` intent.
 * Pure function so it stays unit-testable.
 */
export interface SkillSearchable {
  id: string;
  name: string;
  category?: string | null;
  gatewaySlug?: string | null;
  tags?: string | null;
}

export function findSkillForQuery<T extends SkillSearchable>(
  skills: T[],
  query: string
): T | null {
  if (skills.length === 0) return null;
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const tokens = q.split(/\s+/).filter(Boolean);
  let best: { skill: T; score: number } | null = null;

  for (const skill of skills) {
    let score = 0;
    const name = skill.name.toLowerCase();
    const slug = (skill.gatewaySlug ?? '').toLowerCase();
    const cat = (skill.category ?? '').toLowerCase();
    const tags = (skill.tags ?? '').toLowerCase();

    if (slug && slug === q) score += 100;
    if (name === q) score += 80;

    for (const tok of tokens) {
      if (slug.includes(tok)) score += 20;
      if (name.includes(tok)) score += 15;
      if (tags.includes(tok)) score += 8;
      if (cat.includes(tok)) score += 5;
    }

    if (best === null || score > best.score) {
      best = { skill, score };
    }
  }

  return best && best.score >= 10 ? best.skill : null;
}
