import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import matter from 'gray-matter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills/publish
 *
 * Publish a skill from a SKILL.md file with YAML frontmatter.
 * Auth: Bearer API key (same as /api/v1/run).
 *
 * Body: { skillMd: string }
 *
 * Required frontmatter:
 *   name:        string
 *   description: string
 *   endpoint:    string  (https://...)
 *   price:       number  (USDC per call)
 *   category:    string
 *
 * Optional frontmatter:
 *   icon:           string  (emoji, default "📦")
 *   tags:           string  (comma-separated)
 *   input_schema:   object  (JSON Schema)
 *   output_schema:  object  (JSON Schema)
 *   example_input:  object
 *   example_output: object
 *   hmac_secret:    string  (gateway→endpoint auth)
 *
 * Response 201: { skillId, gatewaySlug, url }
 */
export async function POST(req: NextRequest) {
  // --- Auth ---
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Authorization: Bearer <api_key>' },
      { status: 401 },
    );
  }
  const apiKey = auth.slice(7).trim();

  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // --- Parse body ---
  const body = await req.json().catch(() => ({}));
  const { skillMd } = body as { skillMd?: string };

  if (!skillMd || typeof skillMd !== 'string') {
    return NextResponse.json(
      { error: '`skillMd` (SKILL.md file content as string) is required' },
      { status: 400 },
    );
  }

  // --- Parse frontmatter ---
  let frontmatter: Record<string, unknown>;
  let fileContent: string;
  try {
    const parsed = matter(skillMd);
    frontmatter = parsed.data;
    fileContent = parsed.content.trim();
  } catch {
    return NextResponse.json(
      { error: 'Failed to parse SKILL.md — check YAML frontmatter syntax' },
      { status: 400 },
    );
  }

  // --- Validate required fields ---
  const { name, description, endpoint, price, category } = frontmatter as {
    name?: string;
    description?: string;
    endpoint?: string;
    price?: number;
    category?: string;
  };

  const missing = [];
  if (!name) missing.push('name');
  if (!description) missing.push('description');
  if (!endpoint) missing.push('endpoint');
  if (price == null) missing.push('price');
  if (!category) missing.push('category');

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required frontmatter fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  // Validate endpoint URL and block private/internal IPs (SSRF prevention)
  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint as string);
  } catch {
    return NextResponse.json(
      { error: 'Invalid endpoint URL' },
      { status: 400 },
    );
  }

  const host = parsedEndpoint.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === '::1' ||
    /^fc00:/i.test(host) ||
    /^fd[0-9a-f]{2}:/i.test(host);

  if (isPrivate || parsedEndpoint.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Endpoint must be a public HTTPS URL' },
      { status: 400 },
    );
  }

  if (typeof price !== 'number' || price < 0) {
    return NextResponse.json(
      { error: '`price` must be a non-negative number (USDC per call)' },
      { status: 400 },
    );
  }

  // --- Generate gatewaySlug from name ---
  const baseSlug = (name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure uniqueness
  let gatewaySlug = baseSlug;
  const existing = await prisma.skill.findUnique({ where: { gatewaySlug } });
  if (existing) {
    gatewaySlug = `${baseSlug}-${Date.now()}`;
  }

  // --- Optional fields ---
  const icon = typeof frontmatter.icon === 'string' ? frontmatter.icon : '📦';
  const tags = typeof frontmatter.tags === 'string' ? frontmatter.tags : '';
  const hmacSecret = typeof frontmatter.hmac_secret === 'string' ? frontmatter.hmac_secret : null;

  const inputSchema = frontmatter.input_schema
    ? JSON.stringify(frontmatter.input_schema)
    : null;
  const outputSchema = frontmatter.output_schema
    ? JSON.stringify(frontmatter.output_schema)
    : null;
  const exampleInput = frontmatter.example_input
    ? JSON.stringify(frontmatter.example_input)
    : null;
  const exampleOutput = frontmatter.example_output
    ? JSON.stringify(frontmatter.example_output)
    : null;

  // --- Create skill ---
  let skill;
  try {
    skill = await prisma.skill.create({
      data: {
        name: (name as string).trim(),
        description: (description as string).trim(),
        category: (category as string).trim(),
        icon,
        tags,
        price: price as number,
        pricePerCall: price as number,
        skillType: 'active',
        endpointUrl: endpoint as string,
        gatewaySlug,
        fileContent: fileContent || null,
        fileType: 'markdown',
        isGated: false,
        creatorHmacSecret: hmacSecret,
        inputSchema,
        outputSchema,
        exampleInput,
        exampleOutput,
        creatorId: user.id,
      },
    });
  } catch (err: unknown) {
    // P2002 = unique constraint violation (slug race between check and insert)
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'A skill with this name already exists — choose a different name' },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      skillId: skill.id,
      gatewaySlug: skill.gatewaySlug,
      url: `/skill/${skill.id}`,
    },
    { status: 201 },
  );
}
