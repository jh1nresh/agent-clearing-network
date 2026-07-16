"use client";

/**
 * CommandHelpCard — buyer "help" intent renderer.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (5 buyer intents listed)
 *
 * Styled as an editorial sidebar with a double-rule caption header.
 * Phase 2 intents are listed but greyed out so users see what's coming.
 */

interface CommandRow {
  cmd: string;
  desc: string;
  phase2?: boolean;
}

const COMMANDS: CommandRow[] = [
  { cmd: "list skills", desc: "Browse the marketplace" },
  { cmd: "call <name>", desc: "Sandbox-run a skill in chat" },
  { cmd: "publish", desc: "Publish a new skill (6-step wizard)" },
  { cmd: "price of BTC", desc: "Shortcut → Token Price Oracle" },
  { cmd: "echo", desc: "Shortcut → Echo Test" },
  { cmd: "help", desc: "Show this list" },
  { cmd: "my sessions", desc: "Phase 2 — open sessions list", phase2: true },
  { cmd: "close session <id>", desc: "Phase 2 — settle a session", phase2: true },
];

export function CommandHelpCard() {
  return (
    <figure className="my-1">
      <figcaption className="mb-2 flex items-baseline justify-between border-b-[3px] border-double border-[#1a1a1a]/60 pb-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#1a1a1a]/70">
          Command Desk
        </span>
        <span className="font-mono text-[9px] text-[#1a1a1a]/30">
          {COMMANDS.filter((c) => !c.phase2).length} live
        </span>
      </figcaption>

      <table className="w-full">
        <tbody>
          {COMMANDS.map((row) => (
            <tr
              key={row.cmd}
              className="border-b border-dotted border-[#1a1a1a]/15 last:border-b-0"
            >
              <td className="py-1.5 pr-4 align-top">
                <code
                  className={`font-mono text-[11px] ${
                    row.phase2
                      ? "text-[#1a1a1a]/25"
                      : "font-bold text-[#b08d57]"
                  }`}
                >
                  {row.cmd}
                </code>
              </td>
              <td
                className={`py-1.5 align-top font-serif text-[13px] leading-snug ${
                  row.phase2 ? "italic text-[#1a1a1a]/30" : "text-[#1a1a1a]/70"
                }`}
              >
                {row.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default CommandHelpCard;
