/**
 * Structured logger — thin wrapper for JSON output to stderr.
 * Phase 2 TODO: replace with Sentry/APM integration.
 */

type LogLevel = 'info' | 'warn' | 'error';

function log(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...meta,
  };

  const out = JSON.stringify(entry);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export function logInfo(
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  log('info', context, message, meta);
}

export function logWarn(
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  log('warn', context, message, meta);
}

export function logError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  log('error', context, message, { ...(stack && { stack }), ...meta });
}
