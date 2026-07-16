"use client";

/**
 * JsonOutput — Phase 1 output renderer for `outputShape: 'json'`.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * Renders JSON payloads in a newspaper-monospaced block. When `data` is null
 * we fall back to `example` so creators can see what the buyer will see even
 * before any sandbox call has happened (Publish Wizard Step 5 dogfooding).
 */

export interface JsonOutputProps {
  data?: unknown;
  example?: unknown;
  mode?: "sandbox" | "real";
}

export function JsonOutput({ data, example, mode = "sandbox" }: JsonOutputProps) {
  const value = data !== undefined && data !== null ? data : example;
  const isPlaceholder = data === undefined || data === null;

  if (value === undefined || value === null) {
    return (
      <div className="border border-dashed border-[#b8a990] bg-[#f8f5ef] p-3 font-mono text-[10px] text-[#1a1a1a]/40">
        No example output yet.
      </div>
    );
  }

  let formatted: string;
  try {
    formatted = JSON.stringify(value, null, 2);
  } catch {
    formatted = String(value);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/50">
          {isPlaceholder ? "Example output" : `Response (${mode})`}
        </span>
      </div>
      <pre
        className={`whitespace-pre-wrap break-words border bg-[#f8f5ef] p-3 font-mono text-[11px] leading-snug text-[#1a1a1a] ${
          isPlaceholder
            ? "border-dashed border-[#b8a990] text-[#1a1a1a]/50"
            : "border-[#1a1a1a]"
        }`}
      >
        {formatted}
      </pre>
    </div>
  );
}

export default JsonOutput;
