import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/skills-internal/search
 *
 * Web search skill — returns structured search results via Jina Search.
 * No API key required. Essential for agents doing research / fact-checking.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { query, max_results = 5 } = body as {
    query?: string;
    max_results?: number;
  };

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const limit = Math.min(Math.max(1, max_results), 10);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(
      `https://s.jina.ai/${encodeURIComponent(query)}`,
      { headers, signal: AbortSignal.timeout(15000) },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Search failed: ${res.status}`, query },
        { status: 502 },
      );
    }

    const json = await res.json();
    const results = (json.data ?? [])
      .slice(0, limit)
      .map((r: Record<string, unknown>) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        description: r.description ?? '',
        content: r.content ?? '',
      }));

    return NextResponse.json({
      query,
      results,
      result_count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: msg, query }, { status: 502 });
  }
}
