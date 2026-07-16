// ─── Micro Evaluator for Skills ─────────────────────────────────────────────
// Simple quality evaluator for MVP skill validation

export interface EvaluationResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
}

// Valid categories for skills
// Categories must match the frontend create form + API routes (Title Case)
const VALID_CATEGORIES = [
  "trading",
  "security",
  "content",
  "defi",
  "analytics",
  "infra",
  "social",
  "development",
  "design",
  "marketing",
  "writing",
  "data",
  "automation",
  "devops",
  "ai",
  "blockchain",
  "finance",
  "support",
  "research",
  "other",
];

// Price range in USD
const MIN_PRICE = 0;
const MAX_PRICE = 100;

// Minimum requirements
const MIN_DESCRIPTION_LENGTH = 50;
const MIN_TAGS_COUNT = 3;

export interface SkillData {
  description: string;
  tags: string; // comma-separated
  price: number;
  category: string;
  name?: string;
  longDescription?: string | null;
}

/**
 * Evaluate a skill for quality and compliance.
 * Returns a score from 0-100 and a list of issues.
 */
export function evaluateSkill(skill: SkillData): EvaluationResult {
  const issues: string[] = [];
  let score = 100;

  // 1. Description length check (25 points)
  const descriptionLength = skill.description?.length ?? 0;
  if (descriptionLength < MIN_DESCRIPTION_LENGTH) {
    issues.push(
      `Description too short: ${descriptionLength} chars (minimum ${MIN_DESCRIPTION_LENGTH})`
    );
    // Proportional penalty
    const penalty = Math.min(25, Math.floor((1 - descriptionLength / MIN_DESCRIPTION_LENGTH) * 25));
    score -= penalty;
  }

  // 2. Tags count check (25 points)
  const tags = skill.tags
    ?.split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0) ?? [];
  const tagsCount = tags.length;
  if (tagsCount < MIN_TAGS_COUNT) {
    issues.push(
      `Insufficient tags: ${tagsCount} (minimum ${MIN_TAGS_COUNT})`
    );
    // Proportional penalty
    const penalty = Math.min(25, Math.floor((1 - tagsCount / MIN_TAGS_COUNT) * 25));
    score -= penalty;
  }

  // 3. Price range check (25 points)
  const price = skill.price ?? 0;
  if (price < MIN_PRICE) {
    issues.push(`Price below minimum: $${price} (minimum $${MIN_PRICE})`);
    score -= 25;
  } else if (price > MAX_PRICE) {
    issues.push(`Price above maximum: $${price} (maximum $${MAX_PRICE})`);
    score -= 25;
  }

  // 4. Category validation (25 points)
  const category = skill.category?.toLowerCase() ?? "";
  if (!VALID_CATEGORIES.includes(category)) {
    issues.push(
      `Invalid category: "${skill.category}" (valid: ${VALID_CATEGORIES.join(", ")})`
    );
    score -= 25;
  }

  // Ensure score stays in valid range
  score = Math.max(0, Math.min(100, score));

  // Pass threshold: 60 points (allows 1 major issue or several minor ones)
  const passed = score >= 60;

  return {
    passed,
    score,
    issues,
  };
}

/**
 * Get a human-readable summary of the evaluation.
 */
export function getEvaluationSummary(result: EvaluationResult): string {
  if (result.passed) {
    if (result.score === 100) {
      return "Excellent! Skill meets all quality requirements.";
    }
    return `Passed with score ${result.score}/100. Minor improvements suggested.`;
  }
  return `Failed with score ${result.score}/100. ${result.issues.length} issue(s) found.`;
}

/**
 * Get valid categories list (for API/UI use).
 */
export function getValidCategories(): string[] {
  return [...VALID_CATEGORIES];
}
