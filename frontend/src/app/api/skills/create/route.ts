import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyPrivyAuth } from "@/lib/privy-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/skills/create
 * Create a new skill + upsert user from Privy
 *
 * Body: {
 *   privyId: string;        // from Privy session
 *   email?: string;
 *   walletAddress?: string;
 *   displayName?: string;
 *   name: string;           // skill name
 *   description: string;    // short description
 *   longDescription?: string;
 *   category: string;       // Trading, Security, Content, DeFi, Analytics, Infra, Social
 *   icon?: string;          // emoji (defaults to ⚡)
 *   price: number;          // USD
 *   tags?: string;          // comma-separated
 *   fileContent?: string;   // actual skill content
 *   fileType?: string;      // "markdown" | "json" | "text"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      privyId,
      email,
      walletAddress,
      displayName,
      name,
      description,
      longDescription,
      category,
      icon,
      price,
      tags,
      fileContent,
      fileType,
      skillType,
      gatewaySlug,
      pricePerCall,
      endpointUrl,
      // Wizard profile fields
      executionKind,
      inputShape,
      outputShape,
      estLatencyMs,
      sandboxable,
      authRequired,
      inputSchema,
      outputSchema,
      exampleInput,
      exampleOutput,
    } = body;

    // Validate required fields
    if (!privyId) {
      return NextResponse.json(
        { error: "Missing required field: privyId" },
        { status: 400 }
      );
    }

    // Auth — verify caller owns the privyId they're creating skills under
    const skipAuth =
      process.env.DOJO_SKIP_PRIVY_AUTH === 'true' &&
      process.env.NODE_ENV !== 'production';

    if (!skipAuth) {
      const authResult = await verifyPrivyAuth(req.headers.get('Authorization'));
      if (!authResult.success || authResult.privyId !== privyId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    if (!name || !description || !category) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, category" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ["Trading", "Security", "Content", "DeFi", "Analytics", "Infra", "Social"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate price
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Invalid price. Must be a non-negative number." },
        { status: 400 }
      );
    }

    // Upsert user from Privy identity
    const user = await prisma.user.upsert({
      where: { privyId },
      update: {
        ...(email && { email }),
        ...(displayName && { displayName }),
        // walletAddress intentionally excluded — only set at registration,
        // not overridable via skill create (prevents settlement fund redirect attacks)
      },
      create: {
        privyId,
        email: email ?? null,
        walletAddress: walletAddress ?? null,
        displayName: displayName ?? null,
      },
    });

    // Validate fileType if provided
    const validFileTypes = ["markdown", "json", "text"];
    if (fileType && !validFileTypes.includes(fileType)) {
      return NextResponse.json(
        { error: `Invalid fileType. Must be one of: ${validFileTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate active skill requirements.
    // Wizard-created: endpointUrl provided but gatewaySlug not (slug is auto-generated).
    // This is detected server-side from payload shape — no client flag trusted.
    const isWizardCreated = !!endpointUrl && !gatewaySlug;
    const effectiveSkillType = isWizardCreated ? 'active' : (skillType ?? 'passive');

    if (effectiveSkillType === 'active') {
      // Wizard-created skills auto-generate gatewaySlug; manual creation requires it
      if (!isWizardCreated && !gatewaySlug) {
        return NextResponse.json(
          { error: "gatewaySlug is required for active skills" },
          { status: 400 }
        );
      }
      const parsedPricePerCall = Number(pricePerCall);
      if (!pricePerCall || isNaN(parsedPricePerCall) || parsedPricePerCall <= 0) {
        return NextResponse.json(
          { error: "pricePerCall must be > 0 for active skills" },
          { status: 400 }
        );
      }
    }

    // Auto-generate gatewaySlug for wizard-created skills: kebab-case name + 6-char hex
    let finalSlug = gatewaySlug ?? null;
    if (isWizardCreated && !finalSlug) {
      const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      // Retry up to 3 times on unique constraint collision
      for (let attempt = 0; attempt < 3; attempt++) {
        const suffix = randomBytes(3).toString('hex');
        const candidate = `${base}-${suffix}`;
        const existing = await prisma.skill.findUnique({
          where: { gatewaySlug: candidate },
          select: { id: true },
        });
        if (!existing) {
          finalSlug = candidate;
          break;
        }
      }
      if (!finalSlug) {
        return NextResponse.json(
          { error: 'Failed to generate unique slug after 3 attempts' },
          { status: 500 }
        );
      }
    }

    // Auto-generate HMAC secret for wizard-created skills
    const finalHmacSecret = isWizardCreated
      ? randomBytes(32).toString('hex')
      : undefined;

    // SSRF guard — reject private/internal addresses at write time.
    // The gateway fires this URL on every agent call; blocking here is
    // defence-in-depth over the per-request check in the gateway/run route.
    if (endpointUrl) {
      let parsedEndpoint: URL;
      try {
        parsedEndpoint = new URL(endpointUrl as string);
      } catch {
        return NextResponse.json(
          { error: 'endpointUrl is not a valid URL' },
          { status: 400 }
        );
      }
      const isProduction = process.env.NODE_ENV === 'production';
      if (
        parsedEndpoint.protocol !== 'https:' &&
        !(parsedEndpoint.protocol === 'http:' && !isProduction)
      ) {
        return NextResponse.json(
          { error: 'endpointUrl must use https' },
          { status: 400 }
        );
      }
      if (isProduction) {
        const h = parsedEndpoint.hostname.toLowerCase();
        const BLOCKED_PATTERNS = [
          /^localhost$/,
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2\d|3[01])\./,
          /^192\.168\./,
          /^169\.254\./,
          /^::1$/,
          /^fc00:/,
          /^fd/,
          /^fe[89ab][0-9a-f]:/i,
        ];
        if (BLOCKED_PATTERNS.some((rx) => rx.test(h))) {
          return NextResponse.json(
            { error: 'endpointUrl targets a private or internal address' },
            { status: 400 }
          );
        }
      }
    }

    // Stringify schema/example fields if passed as objects
    const stringify = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      return typeof v === 'string' ? v : JSON.stringify(v);
    };

    // Create the skill
    const skill = await prisma.skill.create({
      data: {
        name,
        description,
        longDescription: longDescription ?? null,
        category,
        icon: icon || "⚡",
        price: parsedPrice,
        currency: "USD",
        tags: tags ?? "",
        fileContent: fileContent ?? null,
        fileType: fileType ?? null,
        isGated: parsedPrice > 0,
        creatorId: user.id,
        skillType: effectiveSkillType,
        gatewaySlug: finalSlug,
        pricePerCall: pricePerCall ? Number(pricePerCall) : null,
        endpointUrl: endpointUrl ?? null,
        creatorHmacSecret: finalHmacSecret ?? null,
        // Profile fields
        executionKind: executionKind ?? null,
        inputShape: inputShape ?? null,
        outputShape: outputShape ?? null,
        estLatencyMs: estLatencyMs ? Number(estLatencyMs) : undefined,
        sandboxable: sandboxable ?? null,
        authRequired: authRequired ?? null,
        inputSchema: stringify(inputSchema),
        outputSchema: stringify(outputSchema),
        exampleInput: stringify(exampleInput),
        exampleOutput: stringify(exampleOutput),
      },
      include: {
        creator: true,
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/skills/create]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
