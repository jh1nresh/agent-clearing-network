/**
 * PullQuote — editorial lead extracted from body copy.
 *
 * Spec: specs/2026-04-09-chat-first-ui.md (editorial polish §PullQuote)
 *
 * Use this for the opening "tagline" of a long-form block (skill detail
 * longDescription, creator bio, etc.) where you want the first sentence to
 * carry disproportionate visual weight — drop cap, oversized italic serif,
 * hanging opening quote, thick ink rule on the left.
 *
 * Styling lives in globals.css `.editorial-pull-quote` so the component
 * stays a presentational shell and the treatment can be tuned without a
 * React rebuild.
 *
 * Usage:
 *   <PullQuote>The first sentence worth pulling out.</PullQuote>
 *
 * Intentionally a server-compatible component (no "use client") — it's
 * pure markup.
 */

import type { ReactNode } from "react";

export interface PullQuoteProps {
  children: ReactNode;
  className?: string;
}

export function PullQuote({ children, className = "" }: PullQuoteProps) {
  return (
    <blockquote className={`editorial-pull-quote ${className}`.trim()}>
      {children}
    </blockquote>
  );
}

export default PullQuote;
