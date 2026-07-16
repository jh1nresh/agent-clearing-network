/**
 * Profile-driven skill renderer — runtime types & parser.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md
 *
 * SQLite has no native JSON type, so JSON Schema / examples are stored as
 * stringified JSON in the Skill table. This module is the canonical place
 * to read those columns and turn them into typed objects.
 *
 * Invariant #1: Skills declare capabilities via executionProfile, UI renders
 * capabilities. Components must consume `parseSkillProfile(skill)` and never
 * touch the raw String columns directly.
 */

export type ExecutionKind =
  | 'sync'
  | 'async'
  | 'stream'
  | 'download'
  | 'stateful'
  | 'hitl';

export type InputShape = 'form' | 'file' | 'custom';

export type OutputShape =
  | 'json'
  | 'text'
  | 'image'
  | 'audio'
  | 'file'
  | 'html'
  | 'stream';

export interface ExecutionProfile {
  kind: ExecutionKind;
  inputShape: InputShape;
  outputShape: OutputShape;
  estLatencyMs: number;
  sandboxable: boolean;
  authRequired: boolean;
}

/** Minimal JSON Schema subset our Phase 1 FormRenderer understands. */
export interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
}

export interface JsonSchemaObject {
  type?: 'object';
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
}

/**
 * Shape returned to UI components — never raw Prisma fields.
 */
export interface SkillProfileBundle {
  profile: ExecutionProfile;
  inputSchema: JsonSchemaObject | null;
  outputSchema: JsonSchemaObject | null;
  exampleInput: Record<string, unknown> | null;
  exampleOutput: unknown;
}

/** Subset of Skill row this module needs. Loose to keep imports cheap. */
export interface SkillProfileSource {
  executionKind?: string | null;
  inputShape?: string | null;
  outputShape?: string | null;
  estLatencyMs?: number | null;
  sandboxable?: boolean | null;
  authRequired?: boolean | null;
  inputSchema?: string | null;
  outputSchema?: string | null;
  exampleInput?: string | null;
  exampleOutput?: string | null;
}

const VALID_KINDS: ReadonlySet<ExecutionKind> = new Set([
  'sync',
  'async',
  'stream',
  'download',
  'stateful',
  'hitl',
]);

const VALID_INPUT_SHAPES: ReadonlySet<InputShape> = new Set([
  'form',
  'file',
  'custom',
]);

const VALID_OUTPUT_SHAPES: ReadonlySet<OutputShape> = new Set([
  'json',
  'text',
  'image',
  'audio',
  'file',
  'html',
  'stream',
]);

function safeParse<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asKind(value: string | null | undefined): ExecutionKind {
  return value && VALID_KINDS.has(value as ExecutionKind)
    ? (value as ExecutionKind)
    : 'sync';
}

function asInputShape(value: string | null | undefined): InputShape {
  return value && VALID_INPUT_SHAPES.has(value as InputShape)
    ? (value as InputShape)
    : 'form';
}

function asOutputShape(value: string | null | undefined): OutputShape {
  return value && VALID_OUTPUT_SHAPES.has(value as OutputShape)
    ? (value as OutputShape)
    : 'json';
}

/**
 * Parse a Skill row into a typed bundle. Defaults are safe for legacy rows
 * that pre-date the 2026-04-09 migration (everything coerces to sync+form+json).
 */
export function parseSkillProfile(
  skill: SkillProfileSource
): SkillProfileBundle {
  const profile: ExecutionProfile = {
    kind: asKind(skill.executionKind),
    inputShape: asInputShape(skill.inputShape),
    outputShape: asOutputShape(skill.outputShape),
    estLatencyMs:
      typeof skill.estLatencyMs === 'number' && skill.estLatencyMs > 0
        ? skill.estLatencyMs
        : 2000,
    sandboxable: skill.sandboxable ?? true,
    authRequired: skill.authRequired ?? false,
  };

  return {
    profile,
    inputSchema: safeParse<JsonSchemaObject>(skill.inputSchema),
    outputSchema: safeParse<JsonSchemaObject>(skill.outputSchema),
    exampleInput: safeParse<Record<string, unknown>>(skill.exampleInput),
    exampleOutput: safeParse(skill.exampleOutput),
  };
}

/**
 * Pull initial form values from inputSchema defaults, falling back to the
 * skill's exampleInput for any missing keys.
 */
export function buildInitialFormValues(
  bundle: SkillProfileBundle
): Record<string, unknown> {
  const seed: Record<string, unknown> = {};

  if (bundle.inputSchema?.properties) {
    for (const [key, prop] of Object.entries(bundle.inputSchema.properties)) {
      if (prop.default !== undefined) {
        seed[key] = prop.default;
      }
    }
  }

  if (bundle.exampleInput) {
    for (const [key, value] of Object.entries(bundle.exampleInput)) {
      if (seed[key] === undefined) {
        seed[key] = value;
      }
    }
  }

  return seed;
}
