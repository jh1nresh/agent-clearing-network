"use client";

/**
 * TextOutput — Phase 1 output renderer for `outputShape: 'text'`.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * For skills whose response is a plain string (translation, summarisation,
 * etc.). If the upstream returned an object that *contains* a text field,
 * we look in common keys (`text`, `output`, `content`) before stringifying.
 */

export interface TextOutputProps {
  data?: unknown;
  example?: unknown;
  mode?: "sandbox" | "real";
}

const TEXT_KEYS = ["text", "output", "content", "result", "message"] as const;

function pickText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    for (const key of TEXT_KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === "string") return v;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

export function TextOutput({ data, example, mode = "sandbox" }: TextOutputProps) {
  const isPlaceholder = data === undefined || data === null;
  const value = pickText(isPlaceholder ? example : data);

  if (value === null) {
    return (
      <div className="border border-dashed border-[#b8a990] bg-[#f8f5ef] p-3 font-mono text-[10px] text-[#1a1a1a]/40">
        No text output yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/50">
        {isPlaceholder ? "Example output" : `Response (${mode})`}
      </span>
      <div
        className={`whitespace-pre-wrap break-words border bg-[#f8f5ef] p-3 font-serif text-sm leading-relaxed text-[#1a1a1a] ${
          isPlaceholder
            ? "border-dashed border-[#b8a990] text-[#1a1a1a]/50"
            : "border-[#1a1a1a]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default TextOutput;
