/**
 * Chat message types for the Phase 1 Dojo chat room.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * Discriminated union — every renderer in `ChatMessage.tsx` must handle
 * each `kind` exhaustively. Add a new card → extend this union, then
 * update the renderer switch (TypeScript will yell about missing cases).
 */

import type { SkillExecutorSkill } from "../skill/SkillExecutor";

export interface ChatSkillSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  pricePerCall: number | null;
  gatewaySlug: string | null;
  callCount?: number;
  trustScore?: number;
}

export type ChatMessage =
  | UserText
  | DojoText
  | DojoHelp
  | DojoSkillList
  | DojoSkillExecutor
  | DojoPublishWizard
  | DojoPhase2Stub;

interface BaseMessage {
  id: string;
  ts: number;
}

export interface UserText extends BaseMessage {
  role: "user";
  kind: "text";
  content: string;
}

export interface DojoText extends BaseMessage {
  role: "dojo";
  kind: "text";
  content: string;
  tone?: "neutral" | "warn" | "ok";
}

export interface DojoHelp extends BaseMessage {
  role: "dojo";
  kind: "help";
}

export interface DojoSkillList extends BaseMessage {
  role: "dojo";
  kind: "skill-list";
  skills: ChatSkillSummary[];
}

export interface DojoSkillExecutor extends BaseMessage {
  role: "dojo";
  kind: "skill-executor";
  skill: SkillExecutorSkill & ChatSkillSummary;
}

export interface DojoPublishWizard extends BaseMessage {
  role: "dojo";
  kind: "publish-wizard";
}

export interface DojoPhase2Stub extends BaseMessage {
  role: "dojo";
  kind: "phase-2-stub";
  feature: string;
}

let _seq = 0;
export function nextMessageId(): string {
  _seq += 1;
  return `m${Date.now()}-${_seq}`;
}
