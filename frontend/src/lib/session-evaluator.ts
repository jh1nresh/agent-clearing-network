/**
 * Session Evaluator — Phase 1 sanity-check
 *
 * Per-call binary evaluation: delivered? format? latency < 5s?
 * score = 1.0 (pass) | 0.0 (fail)
 *
 * Phase 2+: pluggable domain evaluators via EvaluatorRegistry.
 */

import { keccak256, toHex } from 'viem';

export interface EvalResult {
  responseHash: string;  // keccak256(responseBody); empty string on gateway_error
  delivered: boolean;    // httpStatus 2xx AND response received (no timeout/network error)
  validFormat: boolean;  // response body is parseable JSON
  withinSla: boolean;    // latencyMs < 5000
  score: number;         // 0.0 | 1.0
}

const SLA_THRESHOLD_MS = 5_000;

/**
 * Evaluate a single skill call.
 *
 * @param httpStatus   HTTP status from creator (0 if gateway-layer failure)
 * @param responseBody Raw response body text (empty string on gateway error)
 * @param latencyMs    Time from request send to first byte (or abort)
 * @param failed       True if request never reached creator (timeout, network error)
 */
export function evaluateCall(
  httpStatus: number,
  responseBody: string,
  latencyMs: number,
  failed: boolean
): EvalResult {
  const delivered = !failed && httpStatus >= 200 && httpStatus < 300;

  // Note: empty 2xx body → validFormat = false → score = 0.0.
  // Skill creators must return a non-empty JSON object on success.
  let validFormat = false;
  if (delivered && responseBody.length > 0) {
    try {
      JSON.parse(responseBody);
      validFormat = true;
    } catch {
      validFormat = false;
    }
  }

  const withinSla = !failed && latencyMs < SLA_THRESHOLD_MS;

  const score = delivered && validFormat && withinSla ? 1.0 : 0.0;

  const responseHash = keccak256(toHex(responseBody));

  return { responseHash, delivered, validFormat, withinSla, score };
}
