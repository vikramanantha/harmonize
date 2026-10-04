// The shared SpacetimeDB Maincloud database (anonymous reads and reducer calls
// over its HTTP API). Same thing the `spacetime` CLI does:
//   spacetime sql  -s maincloud --anonymous harmony-1o7k0 "SELECT ..."
//   spacetime call -s maincloud --anonymous harmony-1o7k0 save_match ...
import { config } from "./config";

export class SpacetimeError extends Error {}

export type TasteProfile = { id: number; name: string; username: string; summary: string };

const base = () => `${config.spacetime.host}/v1/database/${encodeURIComponent(config.spacetime.database)}`;

/** Runs one SELECT and returns its rows as arrays in column order. */
export async function sql(query: string): Promise<unknown[][]> {
  const response = await fetch(`${base()}/sql`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new SpacetimeError(`SpacetimeDB SQL failed (${response.status}): ${await response.text()}`);
  const results = (await response.json()) as { rows: unknown[][] }[];
  return results[0]?.rows ?? [];
}

/** Calls a reducer with positional JSON arguments. */
export async function call(reducer: string, args: unknown[]): Promise<void> {
  const response = await fetch(`${base()}/call/${encodeURIComponent(reducer)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new SpacetimeError(`SpacetimeDB call ${reducer} failed (${response.status}): ${await response.text()}`);
}

/** Instagram's own rules: 1-30 characters, letters, digits, dots and underscores. */
export function isValidUsername(username: unknown): username is string {
  return typeof username === "string" && /^[A-Za-z0-9._]{1,30}$/.test(username);
}

export async function tasteProfileByUsername(username: string): Promise<TasteProfile | null> {
  if (!isValidUsername(username)) throw new SpacetimeError(`Invalid Instagram username: ${JSON.stringify(username)}`);
  // Validated above, so the only quoting needed is for the dot/underscore-free value itself.
  const rows = await sql(`SELECT id, name, username, summary FROM taste_profile WHERE username = '${username}'`);
  const row = rows[0];
  if (!row) return null;
  return { id: toNumber(row[0]), name: String(row[1]), username: String(row[2]), summary: String(row[3]) };
}

export async function saveTasteProfile(name: string, username: string, summary: string): Promise<void> {
  await call("save_taste_profile", [name, username, summary]);
}

export async function saveMatch(profileA: number, profileB: number, score: number, verdict: string): Promise<void> {
  await call("save_match", [profileA, profileB, score, verdict]);
}

// u64 columns arrive as a JSON number or, for large values, a string.
function toNumber(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isSafeInteger(n)) throw new SpacetimeError(`Unexpected id value from SpacetimeDB: ${JSON.stringify(value)}`);
  return n;
}
