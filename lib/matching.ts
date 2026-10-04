// What happens when a phone reports "I just read <username> over Bluetooth".
//
//   1. Record the sighting.
//   2. Score the pair (once; cached in SQLite and written to match_result).
//   3. If the score clears MATCH_THRESHOLD and the other phone reported us within
//      PROXIMITY_WINDOW_MS, and both users consented, text both through Photon,
//      at most once per ENCOUNTER_COOLDOWN_MS.
//
// Only this server's own scores (SQLite) authorize a text. match_result in
// SpacetimeDB is written for the shared dashboard but never read for that,
// because anyone can write to it.
import { config } from "./config";
import { accountByUsername, db, pairKey, type Account } from "./db";
import { notifier } from "./notify";
import { similarity, verdictFor } from "./scorer";
import { saveMatch, tasteProfileByUsername, type TasteProfile } from "./spacetime";

export type EncounterStatus =
  | "done"             // LOOP is off and this user was already notified of a match
  | "no_profile"       // the other user has no taste_profile yet
  | "not_a_match"
  | "match_waiting"    // a match, but the other phone hasn't reported us within the window
  | "match_no_consent" // a match, but one side hasn't agreed to be texted
  | "already_notified" // both were texted about this encounter already
  | "notified";

export type EncounterResult = {
  status: EncounterStatus;
  other_username: string;
  other_name?: string;
  score?: number;
  verdict?: string;
  matched?: boolean;
};

type Score = { pair: string; profile_a: number; profile_b: number; score: number; verdict: string; scored_at: number };

// Serialises encounter handling so two phones reporting at the same instant
// can't both decide to send the texts.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

export function handleEncounter(me: Account, otherUsername: string): Promise<EncounterResult> {
  return serial(() => handle(me, otherUsername));
}

async function handle(me: Account, otherUsername: string): Promise<EncounterResult> {
  if (me.profile_status !== "ready" || !me.username) throw new Error("Your profile is not ready yet.");
  if (otherUsername === me.username) throw new Error("A phone reported its own username.");
  const now = Date.now();
  db().prepare("INSERT INTO sightings (me, other, seen_at) VALUES (?, ?, ?)").run(me.username, otherUsername, now);

  if (!config.loop && wasNotified(me.username)) return { status: "done", other_username: otherUsername };

  const [mine, theirs] = await Promise.all([tasteProfileByUsername(me.username), tasteProfileByUsername(otherUsername)]);
  if (!mine) throw new Error(`Your taste_profile row for "${me.username}" is missing from SpacetimeDB.`);
  if (!theirs) return { status: "no_profile", other_username: otherUsername };

  const score = await scorePair(mine, theirs);
  const base = { other_username: theirs.username, other_name: theirs.name, score: score.score, verdict: score.verdict };
  const matched = score.score >= config.matchThreshold;
  if (!matched) return { status: "not_a_match", matched, ...base };

  const theySawMe = db().prepare("SELECT 1 FROM sightings WHERE me = ? AND other = ? AND seen_at >= ? LIMIT 1")
    .get(otherUsername, me.username, now - config.proximityWindowMs);
  if (!theySawMe) return { status: "match_waiting", matched, ...base };

  const other = accountByUsername(otherUsername);
  if (!other || !me.consent || !other.consent) return { status: "match_no_consent", matched, ...base };

  const recent = db().prepare("SELECT 1 FROM notifications WHERE pair = ? AND status = 'sent' AND created_at >= ? LIMIT 1")
    .get(score.pair, now - config.encounterCooldownMs);
  if (recent) return { status: "already_notified", matched, ...base };

  await notifyBoth(score, me, mine, other, theirs);
  return { status: "notified", matched, ...base };
}

function wasNotified(username: string): boolean {
  return !!db().prepare("SELECT 1 FROM notifications WHERE username = ? AND status = 'sent' LIMIT 1").get(username);
}

async function scorePair(a: TasteProfile, b: TasteProfile): Promise<Score> {
  const pair = pairKey(a.username, b.username);
  const cached = db().prepare("SELECT * FROM scores WHERE pair = ?").get(pair) as Score | undefined;
  if (cached) return cached;
  const value = await similarity(a.summary, b.summary);
  const verdict = verdictFor(value);
  await saveMatch(a.id, b.id, value, verdict);
  const score: Score = { pair, profile_a: a.id, profile_b: b.id, score: value, verdict, scored_at: Date.now() };
  db().prepare("INSERT INTO scores (pair, profile_a, profile_b, score, verdict, scored_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(score.pair, score.profile_a, score.profile_b, score.score, score.verdict, score.scored_at);
  return score;
}

async function notifyBoth(score: Score, me: Account, mine: TasteProfile, other: Account, theirs: TasteProfile) {
  const percent = Math.round(score.score * 100);
  const errors: string[] = [];
  for (const [recipient, counterpart] of [[me, theirs], [other, mine]] as const) {
    const text = `Harmonize: ${counterpart.name} (@${counterpart.username}) is nearby and you're ${percent}% compatible. ${score.verdict}`;
    try {
      const { message_id } = await notifier().send(recipient.phone_number, text);
      db().prepare("INSERT INTO notifications (pair, username, status, message_id, created_at) VALUES (?, ?, 'sent', ?, ?)")
        .run(score.pair, recipient.username, message_id ?? null, Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db().prepare("INSERT INTO notifications (pair, username, status, error, created_at) VALUES (?, ?, 'failed', ?, ?)")
        .run(score.pair, recipient.username, message, Date.now());
      errors.push(`${recipient.username}: ${message}`);
    }
  }
  if (errors.length) throw new Error(`Match found but texting failed. ${errors.join(" | ")}`);
}

export type MatchRow = { other_username: string; other_name: string | null; score: number; verdict: string; matched: boolean; notified_at: number | null; notify_error: string | null };

/** Everyone this user has been scored against, for the app's list. */
export function matchesFor(username: string): MatchRow[] {
  const rows = db().prepare("SELECT * FROM scores WHERE pair LIKE ? OR pair LIKE ? ORDER BY scored_at DESC").all(`${username}|%`, `%|${username}`) as Score[];
  return rows.map(score => {
    const [a, b] = score.pair.split("|");
    const other = a === username ? b : a;
    const sent = db().prepare("SELECT created_at FROM notifications WHERE pair = ? AND username = ? AND status = 'sent' ORDER BY created_at DESC LIMIT 1").get(score.pair, username) as { created_at: number } | undefined;
    const failed = db().prepare("SELECT error FROM notifications WHERE pair = ? AND username = ? AND status = 'failed' ORDER BY created_at DESC LIMIT 1").get(score.pair, username) as { error: string } | undefined;
    return {
      other_username: other,
      other_name: accountByUsername(other)?.name ?? null,
      score: score.score,
      verdict: score.verdict,
      matched: score.score >= config.matchThreshold,
      notified_at: sent?.created_at ?? null,
      notify_error: sent ? null : failed?.error ?? null,
    };
  });
}

/**
 * Restarts the demo for everyone: forgets who has been texted (so pairs can be
 * texted again and LOOP=false phones resume) and all recent sightings. Match
 * scores are kept; they only depend on the summaries.
 */
export function resetDemo(): { notifications: number; sightings: number } {
  const notifications = Number(db().prepare("DELETE FROM notifications").run().changes);
  const sightings = Number(db().prepare("DELETE FROM sightings").run().changes);
  return { notifications, sightings };
}

