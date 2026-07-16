import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills-internal/scrape
 *
 * Web scraper skill — converts any URL to structured markdown via Jina Reader.
 * No API key required. Genuinely useful for agent RAG / research pipelines.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Scrape failed: ${res.status}`, url },
        { status: 502 },
      );
    }

    const json = await res.json();
    const d = json.data ?? {};
    const content = d.content ?? '';

    return NextResponse.json({
      url: d.url ?? url,
      title: d.title ?? '',
      description: d.description ?? '',
      content,
      word_count: content.split(/\s+/).filter(Boolean).length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Scrape failed';
    return NextResponse.json({ error: msg, url }, { status: 502 });
  }
}
