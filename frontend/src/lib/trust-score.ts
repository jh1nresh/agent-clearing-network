/**
 * Trust Score Calculation — shared module.
 *
 * Weights: 40% success rate, 30% avg rating, 20% jobs (cap 100), 10% attestations (cap 50).
 * Returns a score 0–100 rounded to 2 decimal places.
 */

export interface TrustScoreInput {
  successRate: number;       // 0–1
  avgRating: number;         // 0–5
  jobsCompleted: number;
  attestationCount: number;
}

export interface TrustScoreBreakdown {
  successRate: number;
  rating: number;
  jobs: number;
  attestations: number;
}

export interface TrustScoreResult {
  score: number;
  breakdown: TrustScoreBreakdown;
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const successRate = input.successRate * 0.4;
  const rating = (input.avgRating / 5) * 0.3;
  const jobs = (Math.min(input.jobsCompleted, 100) / 100) * 0.2;
  const attestations = (Math.min(input.attestationCount, 50) / 50) * 0.1;

  const raw = (successRate + rating + jobs + attestations) * 100;
  const score = Math.round(raw * 100) / 100;

  return {
    score,
    breakdown: {
      successRate: Math.round(successRate * 100 * 100) / 100,
      rating: Math.round(rating * 100 * 100) / 100,
      jobs: Math.round(jobs * 100 * 100) / 100,
      attestations: Math.round(attestations * 100 * 100) / 100,
    },
  };
}
