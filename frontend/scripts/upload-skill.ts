/**
 * Skill Upload CLI
 *
 * Upload a SKILL.md file to Dojo as a new skill (creator flow).
 *
 * Usage:
 *   npx tsx scripts/upload-skill.ts --file ./my-skill.md [options]
 *
 * Options:
 *   --file        Path to SKILL.md file (required)
 *   --privy-id    Creator privyId (default: seed platform user)
 *   --slug        Gateway slug for active skills (e.g. "my-skill")
 *   --price       One-time purchase price in USDC (default: 0)
 *   --per-call    Per-call price for active skills in USDC (e.g. 0.001)
 *   --category    Category: Trading|Security|Content|DeFi|Analytics|Infra|Social (default: Infra)
 *   --type        Skill type: passive|active (default: passive)
 *   --endpoint    Creator endpoint URL (required for active skills)
 *   --url         BASE_URL of Dojo instance (default: http://localhost:3000)
 *   --dry-run     Print parsed skill data without uploading
 *
 * SKILL.md frontmatter (optional, overrides CLI flags):
 *   ---
 *   name: My Skill
 *   description: Short description
 *   category: DeFi
 *   price: 2.00
 *   tags: defi,yield,optimizer
 *   ---
 *
 * Prerequisites:
 *   - pnpm dev running on localhost:3000 (or set --url)
 *   - DOJO_SKIP_PRIVY_AUTH=true in .env.local
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Arg parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function arg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function flag(name: string): boolean {
  return args.includes(name);
}

const filePath   = arg('--file');
const privyId    = arg('--privy-id') ?? 'did:privy:seed-platform-001';
const slug       = arg('--slug');
const price      = parseFloat(arg('--price') ?? '0');
const pricePerCall = parseFloat(arg('--per-call') ?? '0');
const category   = arg('--category') ?? 'Infra';
const skillType  = (arg('--type') ?? 'passive') as 'passive' | 'active';
const endpointUrl = arg('--endpoint');
const baseUrl    = arg('--url') ?? process.env.BASE_URL ?? 'http://localhost:3000';
const dryRun     = flag('--dry-run');

if (!filePath) {
  console.error('Error: --file is required');
  console.error('Usage: npx tsx scripts/upload-skill.ts --file ./my-skill.md');
  process.exit(1);
}

if (skillType === 'active' && !slug) {
  console.error('Error: --slug is required for active skills');
  process.exit(1);
}

// ── Parse SKILL.md ─────────────────────────────────────────────────────────────

const raw = readFileSync(resolve(filePath), 'utf-8');

// Extract YAML frontmatter if present
let frontmatter: Record<string, string> = {};
let fileContent = raw;

const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (fmMatch) {
  const yamlBlock = fmMatch[1];
  fileContent = fmMatch[2];
  for (const line of yamlBlock.split('\n')) {
    const [k, ...rest] = line.split(':');
    if (k && rest.length) frontmatter[k.trim()] = rest.join(':').trim();
  }
}

// Extract name from frontmatter or first H1
const name =
  frontmatter['name'] ??
  raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
  require('path').basename(filePath, '.md');

// Extract description from frontmatter or first paragraph after H1
const description =
  frontmatter['description'] ??
  raw.split('\n').find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---')) ??
  '';

const finalCategory = frontmatter['category'] ?? category;
const finalPrice    = frontmatter['price'] ? parseFloat(frontmatter['price']) : price;
const finalTags     = frontmatter['tags'] ?? '';

// ── Build payload ──────────────────────────────────────────────────────────────

const payload = {
  privyId,
  name,
  description,
  category: finalCategory,
  price: finalPrice,
  tags: finalTags,
  fileContent: raw, // store full file including frontmatter
  fileType: 'markdown',
  skillType,
  ...(slug       ? { gatewaySlug: slug }     : {}),
  ...(pricePerCall > 0 ? { pricePerCall }    : {}),
  ...(endpointUrl ? { endpointUrl }          : {}),
};

// ── Output ─────────────────────────────────────────────────────────────────────

console.log('=== Dojo Skill Upload ===');
console.log(`File:     ${resolve(filePath)}`);
console.log(`Name:     ${name}`);
console.log(`Type:     ${skillType}`);
console.log(`Category: ${finalCategory}`);
console.log(`Price:    $${finalPrice}${pricePerCall > 0 ? ` + $${pricePerCall}/call` : ''}`);
if (slug) console.log(`Slug:     ${slug}`);
if (endpointUrl) console.log(`Endpoint: ${endpointUrl}`);
console.log(`PrivyId:  ${privyId}`);
console.log(`Target:   ${baseUrl}/api/skills/create`);

if (dryRun) {
  console.log('\n[dry-run] Payload:');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// ── Upload ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nUploading...');

  const res = await fetch(`${baseUrl}/api/skills/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`\nFailed (HTTP ${res.status}):`, data.error ?? data);
    process.exit(1);
  }

  const skill = data.skill ?? data; // create route returns skill directly
  console.log(`\nDone — skill created:`);
  console.log(`  id:   ${skill.id}`);
  console.log(`  name: ${skill.name}`);
  if (skill.gatewaySlug) console.log(`  slug: ${skill.gatewaySlug}`);
  console.log(`\nView at: ${baseUrl}/marketplace/${skill.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
