"use client";

/**
 * SkillExecutor — the trunk component for Profile-Driven Renderer.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 * ADR: brain/wiki/decisions/2026-04-09-chat-first-publish.md
 *
 * Invariants (DO NOT VIOLATE — adding a new skill must NOT touch this file):
 *   1. SkillExecutor never knows the skill's slug or name.
 *   2. Dispatch is purely table-driven on `executionProfile`.
 *   3. Same component is used in chat sandbox, /skill/[slug], and the
 *      Publish Wizard Step 5 hard gate.
 *   4. To add a new shape, add a row to INPUT_RENDERERS / OUTPUT_RENDERERS
 *      and write the renderer file. Nothing else.
 *
 * Phase 1 supports: kind=sync, inputShape=form, outputShape=json|text|image.
 * Anything else falls back to a "not yet supported" panel so we ship.
 */

import { useMemo, useState } from "react";
import {
  parseSkillProfile,
  buildInitialFormValues,
  type InputShape,
  type OutputShape,
  type SkillProfileBundle,
  type SkillProfileSource,
} from "@/lib/skill-profile";
import { FormRenderer } from "./renderers/inputs/FormRenderer";
import { JsonOutput } from "./renderers/outputs/JsonOutput";
import { TextOutput } from "./renderers/outputs/TextOutput";

// ---------------------------------------------------------------------------
// Renderer dispatch tables — adding a new shape lives here.
// ---------------------------------------------------------------------------

interface InputRendererProps {
  bundle: SkillProfileBundle;
  pending: boolean;
  onSubmit: (values: Record<string, unknown>) => void;
}

interface OutputRendererProps {
  bundle: SkillProfileBundle;
  data: unknown;
  mode: "sandbox" | "real";
}

function FormInputAdapter({ bundle, pending, onSubmit }: InputRendererProps) {
  const initial = useMemo(() => buildInitialFormValues(bundle), [bundle]);
  return (
    <FormRenderer
      schema={bundle.inputSchema}
      initialValues={initial}
      pending={pending}
      onSubmit={onSubmit}
      submitLabel="Run sandbox"
    />
  );
}

function UnsupportedInput({ shape }: { shape: string }) {
  return (
    <div className="border border-dashed border-[#b8a990] bg-[#f8f5ef] p-3 font-mono text-[10px] text-[#1a1a1a]/50">
      Input shape <span className="font-bold">{shape}</span> ships in a later
      phase. See specs/2026-04-09-chat-first-ui.md.
    </div>
  );
}

function UnsupportedOutput({ shape }: { shape: string }) {
  return (
    <div className="border border-dashed border-[#b8a990] bg-[#f8f5ef] p-3 font-mono text-[10px] text-[#1a1a1a]/50">
      Output shape <span className="font-bold">{shape}</span> ships in a later
      phase.
    </div>
  );
}

const INPUT_RENDERERS: Partial<
  Record<InputShape, (props: InputRendererProps) => JSX.Element>
> = {
  form: FormInputAdapter,
  // file: Phase 2
  // custom: Phase 3
};

const OUTPUT_RENDERERS: Partial<
  Record<OutputShape, (props: OutputRendererProps) => JSX.Element>
> = {
  json: ({ bundle, data, mode }) => (
    <JsonOutput data={data} example={bundle.exampleOutput} mode={mode} />
  ),
  text: ({ bundle, data, mode }) => (
    <TextOutput data={data} example={bundle.exampleOutput} mode={mode} />
  ),
  // image, audio, file, html, stream: Phase 2/3
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SkillExecutorSkill extends SkillProfileSource {
  id: string;
  name: string;
}

export interface SkillExecutorProps {
  skill: SkillExecutorSkill;
  /**
   * 'sandbox' = call POST /api/skills/[id]/sandbox (no payment, no session).
   * 'real'    = Phase 2+. Today we still route through sandbox so the trunk
   *             stays profile-driven; the gateway integration owns its own UI.
   */
  mode?: "sandbox" | "real";
  /** Optional onResult hook for chat surfaces that want to capture replies. */
  onResult?: (result: SandboxResult) => void;
}

export interface SandboxResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  data?: unknown;
  error?: string;
  code?: string;
}

export function SkillExecutor({
  skill,
  mode = "sandbox",
  onResult,
}: SkillExecutorProps) {
  const bundle = useMemo(() => parseSkillProfile(skill), [skill]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);

  const InputRenderer = INPUT_RENDERERS[bundle.profile.inputShape];
  const OutputRenderer = OUTPUT_RENDERERS[bundle.profile.outputShape];

  async function runSandbox(values: Record<string, unknown>) {
    if (pending) return;
    setPending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/skills/${skill.id}/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: values }),
      });
      const json = (await res.json()) as SandboxResult;
      setResult(json);
      onResult?.(json);
    } catch (err) {
      const fallback: SandboxResult = {
        ok: false,
        status: 0,
        latencyMs: 0,
        error: err instanceof Error ? err.message : "Network error",
        code: "NETWORK_ERROR",
      };
      setResult(fallback);
      onResult?.(fallback);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="space-y-4 border bg-[#f8f5ef] p-4"
      style={{
        borderColor: "#b8a990",
        borderLeftWidth: "3px",
        borderLeftColor: "#1a1a1a",
      }}
    >
      <header className="flex items-baseline justify-between">
        <h3 className="font-serif text-base font-bold text-[#1a1a1a]">
          {skill.name}
        </h3>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/50">
          {bundle.profile.kind} · {bundle.profile.inputShape} →{" "}
          {bundle.profile.outputShape}
        </span>
      </header>

      <section className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/50">
          Input
        </div>
        {InputRenderer ? (
          <InputRenderer
            bundle={bundle}
            pending={pending}
            onSubmit={runSandbox}
          />
        ) : (
          <UnsupportedInput shape={bundle.profile.inputShape} />
        )}
      </section>

      <section className="space-y-2">
        <div className="font-mono text-[9px] uppercase tracking-wider text-[#1a1a1a]/50">
          Output {pending && "· running…"}
          {result && !pending && (
            <span className="ml-2">
              · {result.latencyMs}ms ·{" "}
              <span className={result.ok ? "text-[#1a1a1a]" : "text-[#dc2626]"}>
                {result.ok ? "ok" : `err ${result.status}`}
              </span>
            </span>
          )}
        </div>

        {OutputRenderer ? (
          <OutputRenderer
            bundle={bundle}
            data={result?.ok ? result.data : null}
            mode={mode}
          />
        ) : (
          <UnsupportedOutput shape={bundle.profile.outputShape} />
        )}

        {result && !result.ok && (
          <div className="border border-[#dc2626] bg-[#fff5f5] p-2 font-mono text-[10px] text-[#dc2626]">
            {result.error ?? `Sandbox returned status ${result.status}`}
          </div>
        )}
      </section>

      {bundle.profile.estLatencyMs && (
        <footer className="font-mono text-[9px] text-[#1a1a1a]/40">
          est. latency ~{bundle.profile.estLatencyMs}ms
        </footer>
      )}
    </div>
  );
}

export default SkillExecutor;
