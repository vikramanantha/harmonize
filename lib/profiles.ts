import { database } from "./neon";

export type TasteProfile = { id: number; name: string; username: string; summary: string };

export function isValidUsername(username: unknown): username is string {
  return typeof username === "string" && /^[A-Za-z0-9._]{1,30}$/.test(username);
}

export async function tasteProfileByUsername(username: string): Promise<TasteProfile | null> {
  if (!isValidUsername(username)) throw new Error("Invalid Instagram username");
  const rows = await database()`SELECT id, name, username, summary FROM taste_profile WHERE username = ${username}`;
  return (rows[0] as TasteProfile | undefined) ?? null;
}

export async function saveTasteProfile(name: string, username: string, summary: string): Promise<void> {
  if (!isValidUsername(username)) throw new Error("Invalid Instagram username");
  await database()`INSERT INTO taste_profile (name, username, summary) VALUES (${name}, ${username}, ${summary})
    ON CONFLICT (username) DO UPDATE SET name = excluded.name, summary = excluded.summary`;
}

export async function saveMatch(a: number, b: number, score: number, verdict: string): Promise<void> {
  const [profileA, profileB] = a < b ? [a, b] : [b, a];
  await database()`INSERT INTO match_result (profile_a, profile_b, score, verdict) VALUES (${profileA}, ${profileB}, ${score}, ${verdict})
    ON CONFLICT (profile_a, profile_b) DO UPDATE SET score = excluded.score, verdict = excluded.verdict`;
}
