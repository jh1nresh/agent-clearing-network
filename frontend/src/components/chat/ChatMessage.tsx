"use client";

/**
 * ChatMessage — single message renderer.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * Layout model = Claude chat × newspaper editorial.
 *   - No bubbles. Each message is a row: small mono role label on top,
 *     serif body beneath, generous vertical rhythm.
 *   - User rows get a subtle inset background + 2px ink accent on the left.
 *   - Dojo rows are flowing text with no container (so embedded cards —
 *     skill list, executor — read as editorial asides, not stacked chrome).
 *   - Tone (warn / ok) is expressed as a left border colour on user-facing
 *     error messages, not a full bubble.
 *
 * Discriminated switch + assertNever means adding a new chat card requires
 * updating both the union in `types.ts` and this switch.
 */

import type { ChatMessage as ChatMsg, ChatSkillSummary } from "./types";
import { SkillListCard } from "./cards/SkillListCard";
import { CommandHelpCard } from "./cards/CommandHelpCard";
import { PublishWizardCard } from "./cards/PublishWizardCard";
import { SkillExecutor } from "../skill/SkillExecutor";

export interface ChatMessageProps {
  message: ChatMsg;
  onRunSkill?: (skill: ChatSkillSummary) => void;
}

function assertNever(x: never): never {
  throw new Error(`Unhandled chat message kind: ${JSON.stringify(x)}`);
}

/** Row scaffold — label + content column, consistent rhythm. */
function Row({
  role,
  children,
}: {
  role: "user" | "dojo";
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 first:mt-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
            role === "user" ? "text-[#1a1a1a]/50" : "text-[#b08d57]/70"
          }`}
        >
          {role === "user" ? "You" : "Dojo"}
        </span>
        <span className="h-px flex-1 bg-[#1a1a1a]/10" />
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Plain text body — serif, editorial leading, no bubble. */
function Body({
  role,
  content,
  tone = "neutral",
}: {
  role: "user" | "dojo";
  content: string;
  tone?: "neutral" | "warn" | "ok";
}) {
  const isUser = role === "user";
  const toneColor =
    tone === "warn"
      ? "border-l-[#dc2626]"
      : tone === "ok"
        ? "border-l-[#1a1a1a]"
        : "border-l-[#1a1a1a]/40";

  if (isUser) {
    return (
      <div
        className={`whitespace-pre-wrap break-words border-l-2 bg-[#1a1a1a]/[0.035] px-4 py-3 font-serif text-[15px] leading-[1.65] text-[#1a1a1a] ${toneColor}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`whitespace-pre-wrap break-words font-serif text-[15px] leading-[1.65] text-[#1a1a1a] ${
        tone === "warn" ? "border-l-2 border-l-[#dc2626] pl-4" : ""
      }`}
    >
      {content}
    </div>
  );
}

export function ChatMessage({ message, onRunSkill }: ChatMessageProps) {
  switch (message.kind) {
    case "text":
      return (
        <Row role={message.role}>
          <Body
            role={message.role}
            content={message.content}
            tone={message.role === "dojo" ? message.tone : "neutral"}
          />
        </Row>
      );

    case "help":
      return (
        <Row role="dojo">
          <CommandHelpCard />
        </Row>
      );

    case "skill-list":
      return (
        <Row role="dojo">
          <SkillListCard skills={message.skills} onRun={onRunSkill} />
        </Row>
      );

    case "skill-executor":
      return (
        <Row role="dojo">
          <SkillExecutor skill={message.skill} mode="sandbox" />
        </Row>
      );

    case "publish-wizard":
      return (
        <Row role="dojo">
          <PublishWizardCard />
        </Row>
      );

    case "phase-2-stub":
      return (
        <Row role="dojo">
          <Body
            role="dojo"
            tone="warn"
            content={`"${message.feature}" ships in Phase 2. For now: try "list skills" or "call <skill name>".`}
          />
        </Row>
      );

    default:
      return assertNever(message);
  }
}

export default ChatMessage;
