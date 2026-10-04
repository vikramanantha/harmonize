// Similarity between two Instagram summaries, computed by the semantic service
// (semantic/service.py: sentence-transformers all-MiniLM-L6-v2, cosine similarity).
import { config } from "./config";

export class ScorerError extends Error {}

/** Cosine similarity, roughly 0 (unrelated) to 1 (same taste). */
export async function similarity(summaryA: string, summaryB: string): Promise<number> {
  let response: Response;
  try {
    response = await fetch(`${config.semanticUrl}/similarity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary_a: summaryA, summary_b: summaryB }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new ScorerError(`Semantic service unreachable at ${config.semanticUrl} (start it with semantic/run.sh): ${error instanceof Error ? error.message : error}`);
  }
  if (!response.ok) throw new ScorerError(`Semantic service error (${response.status}): ${await response.text()}`);
  const body = (await response.json()) as { score?: unknown };
  if (typeof body.score !== "number" || !Number.isFinite(body.score)) throw new ScorerError("Semantic service returned no score");
  return body.score;
}

/**
 * Short text stored with the score and sent in the match text. Fixed bands, not
 * tied to MATCH_THRESHOLD, since the threshold can be tuned after scoring.
 */
export function verdictFor(score: number): string {
  if (score >= 0.85) return "Near-identical taste in reels.";
  if (score >= 0.7) return "Strong overlap in what you watch and share.";
  if (score >= 0.5) return "Some overlap in what you watch.";
  return "Very different feeds.";
}
