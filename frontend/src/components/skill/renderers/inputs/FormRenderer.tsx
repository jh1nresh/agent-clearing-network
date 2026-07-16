"use client";

/**
 * FormRenderer — Phase 1 input renderer for `inputShape: 'form'`.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * Phase 1 supports the JSON Schema subset that covers Token Price Oracle +
 * Echo Test:
 *   - top-level type: object
 *   - properties: string | number | integer | boolean
 *   - enum (renders as <select>)
 *   - title / description / default
 *   - required[] (rendered with red * marker; submission requires non-empty)
 *
 * Anything more complex (nested objects, arrays, conditionals) is Phase 2.
 * The renderer degrades gracefully: unknown types fall through to a text
 * input so creators can still ship.
 *
 * Invariant #5: New input shapes (file, custom) get their own renderer file.
 * This component must not grow shape-specific branches.
 */

import { useMemo, useState } from "react";
import type {
  JsonSchemaObject,
  JsonSchemaProperty,
} from "@/lib/skill-profile";

export interface FormRendererProps {
  schema: JsonSchemaObject | null;
  initialValues?: Record<string, unknown>;
  pending?: boolean;
  submitLabel?: string;
  onSubmit: (values: Record<string, unknown>) => void;
}

interface FieldEntry {
  key: string;
  prop: JsonSchemaProperty;
  required: boolean;
}

function getFields(schema: JsonSchemaObject | null): FieldEntry[] {
  if (!schema?.properties) return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([key, prop]) => ({
    key,
    prop,
    required: required.has(key),
  }));
}

function coerce(prop: JsonSchemaProperty, raw: string): unknown {
  if (raw === "") return undefined;
  if (prop.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (prop.type === "integer") {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : raw;
  }
  if (prop.type === "boolean") {
    return raw === "true";
  }
  return raw;
}

export function FormRenderer({
  schema,
  initialValues = {},
  pending = false,
  submitLabel = "Run",
  onSubmit,
}: FormRendererProps) {
  const fields = useMemo(() => getFields(schema), [schema]);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = { ...initialValues };
    for (const f of fields) {
      if (seed[f.key] === undefined && f.prop.default !== undefined) {
        seed[f.key] = f.prop.default;
      }
    }
    return seed;
  });

  const missingRequired = fields.some(
    (f) =>
      f.required &&
      (values[f.key] === undefined || values[f.key] === null || values[f.key] === "")
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || missingRequired) return;
    // Drop undefined keys before submit so the proxy sees a clean payload.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== "") clean[k] = v;
    }
    onSubmit(clean);
  }

  if (fields.length === 0) {
    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="font-mono text-xs text-[#1a1a1a]/60">
          No declared inputs — this skill takes an empty payload.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#f8f5ef] disabled:opacity-50"
        >
          {pending ? "Running…" : submitLabel}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map(({ key, prop, required }) => {
        const id = `field-${key}`;
        const label = prop.title ?? key;
        const current = values[key] ?? "";
        const isEnum = Array.isArray(prop.enum) && prop.enum.length > 0;

        return (
          <div key={key} className="space-y-1">
            <label
              htmlFor={id}
              className="block font-mono text-[10px] uppercase tracking-wider text-[#1a1a1a]"
            >
              {label}
              {required && <span className="ml-1 text-[#dc2626]">*</span>}
            </label>

            {isEnum ? (
              <select
                id={id}
                value={String(current)}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [key]: coerce(prop, e.target.value),
                  }))
                }
                className="w-full border border-[#b8a990] bg-[#f8f5ef] px-3 py-2 font-mono text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:outline-none"
              >
                {!required && <option value="">—</option>}
                {prop.enum!.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </option>
                ))}
              </select>
            ) : prop.type === "boolean" ? (
              <select
                id={id}
                value={String(current)}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [key]: e.target.value === "true",
                  }))
                }
                className="w-full border border-[#b8a990] bg-[#f8f5ef] px-3 py-2 font-mono text-xs text-[#1a1a1a] focus:border-[#1a1a1a] focus:outline-none"
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                id={id}
                type={
                  prop.type === "number" || prop.type === "integer"
                    ? "number"
                    : "text"
                }
                value={String(current)}
                placeholder={prop.description ?? ""}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    [key]: coerce(prop, e.target.value),
                  }))
                }
                className="w-full border border-[#b8a990] bg-[#f8f5ef] px-3 py-2 font-mono text-xs text-[#1a1a1a] placeholder:text-[#1a1a1a]/30 focus:border-[#1a1a1a] focus:outline-none"
              />
            )}

            {prop.description && !isEnum && (
              <p className="font-mono text-[9px] text-[#1a1a1a]/50">
                {prop.description}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={pending || missingRequired}
        className="border border-[#1a1a1a] bg-[#1a1a1a] px-4 py-2 font-mono text-xs uppercase tracking-wider text-[#f8f5ef] transition disabled:opacity-40"
      >
        {pending ? "Running…" : submitLabel}
      </button>
    </form>
  );
}

export default FormRenderer;
