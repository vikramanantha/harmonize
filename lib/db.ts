// Private server state in a SQLite file. Everything here is data that must not
// go in the shared SpacetimeDB, which anyone can read: phone numbers, device
// tokens, Muse login state, and the scores we trust for sending texts.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { config } from "./config";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT UNIQUE NOT NULL,            -- Muse login email or mobile number
  phone_number TEXT NOT NULL,                 -- where Photon texts this user
  consent INTEGER NOT NULL DEFAULT 0,         -- agreed to be texted about matches
  device_token_hash TEXT UNIQUE,
  browserbase_context_id TEXT,                -- keeps the Muse login for later prompts
  username TEXT UNIQUE,                       -- Instagram username, reported by Muse
  name TEXT,
  profile_status TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | error
  profile_error TEXT,
  callback_token TEXT UNIQUE,                 -- single-use; identifies the pending prompt
  prompted_at INTEGER,
  summarized_at INTEGER,
  refresh_error TEXT,
  photon_error TEXT,                          -- why adding this number to Photon's Users list failed
  photon_line TEXT,                           -- the Photon number this person must text once first
  first_text_at INTEGER,                      -- when the app reported sending that first text
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS logins (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  consent INTEGER NOT NULL,
  auto_approve INTEGER NOT NULL DEFAULT 0,  -- user ticked "approve Muse's access to this server for me"
  session_id TEXT NOT NULL,
  connect_url TEXT NOT NULL,
  context_id TEXT NOT NULL,
  step TEXT NOT NULL,
  busy INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS setup_checks (
  token TEXT PRIMARY KEY,                     -- in the setup-check prompt
  received_at INTEGER                          -- when Muse's test POST arrived
);
CREATE TABLE IF NOT EXISTS sightings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  me TEXT NOT NULL,
  other TEXT NOT NULL,
  seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sightings_pair ON sightings (me, other, seen_at);
CREATE TABLE IF NOT EXISTS scores (
  pair TEXT PRIMARY KEY,                      -- "a|b" with a < b
  profile_a INTEGER NOT NULL,                 -- taste_profile ids
  profile_b INTEGER NOT NULL,
  score REAL NOT NULL,
  verdict TEXT NOT NULL,
  scored_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pair TEXT NOT NULL,
  username TEXT NOT NULL,                     -- recipient
  status TEXT NOT NULL,                       -- sent | failed
  message_id TEXT,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_pair ON notifications (pair, created_at);
`;

export type Account = {
  id: number;
  identifier: string;
  phone_number: string;
  consent: number;
  device_token_hash: string | null;
  browserbase_context_id: string | null;
  username: string | null;
  name: string | null;
  profile_status: "pending" | "ready" | "error";
  profile_error: string | null;
  callback_token: string | null;
  prompted_at: number | null;
  summarized_at: number | null;
  refresh_error: string | null;
  photon_error: string | null;
  photon_line: string | null;
  first_text_at: number | null;
  created_at: number;
};

export type Login = {
  id: string;
  identifier: string;
  phone_number: string;
  consent: number;
  auto_approve: number;
  session_id: string;
  connect_url: string;
  context_id: string;
  step: "code" | "password" | "ready";
  busy: number;
  expires: number;
};

const globalState = globalThis as typeof globalThis & { harmonyDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalState.harmonyDb) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    const database = new DatabaseSync(config.dbPath);
    database.exec("PRAGMA journal_mode = WAL");
    database.exec(SCHEMA);
    // Columns added after the first release; ignore "duplicate column" on newer files.
    try { database.exec("ALTER TABLE logins ADD COLUMN auto_approve INTEGER NOT NULL DEFAULT 0"); } catch {}
    try { database.exec("ALTER TABLE accounts ADD COLUMN photon_error TEXT"); } catch {}
    try { database.exec("ALTER TABLE accounts ADD COLUMN photon_line TEXT"); } catch {}
    try { database.exec("ALTER TABLE accounts ADD COLUMN first_text_at INTEGER"); } catch {}
    globalState.harmonyDb = database;
  }
  return globalState.harmonyDb;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

export function accountByToken(token: string): Account | null {
  return (db().prepare("SELECT * FROM accounts WHERE device_token_hash = ?").get(hashToken(token)) as Account | undefined) ?? null;
}

export function accountById(id: number): Account | null {
  return (db().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Account | undefined) ?? null;
}

export function accountByUsername(username: string): Account | null {
  return (db().prepare("SELECT * FROM accounts WHERE username = ?").get(username) as Account | undefined) ?? null;
}

export function accountByCallbackToken(token: string): Account | null {
  return (db().prepare("SELECT * FROM accounts WHERE callback_token = ?").get(token) as Account | undefined) ?? null;
}

/** Creates the account on first login, or re-issues a device token on a later one. Returns the plain token. */
export function upsertAccount(fields: { identifier: string; phone_number: string; consent: boolean; browserbase_context_id: string | null }): { account: Account; deviceToken: string } {
  const token = newToken();
  db().prepare(`
    INSERT INTO accounts (identifier, phone_number, consent, device_token_hash, browserbase_context_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (identifier) DO UPDATE SET
      phone_number = excluded.phone_number,
      consent = excluded.consent,
      device_token_hash = excluded.device_token_hash,
      browserbase_context_id = excluded.browserbase_context_id
  `).run(fields.identifier, fields.phone_number, fields.consent ? 1 : 0, hashToken(token), fields.browserbase_context_id, Date.now());
  const account = db().prepare("SELECT * FROM accounts WHERE identifier = ?").get(fields.identifier) as Account;
  return { account, deviceToken: token };
}

/** Pair key shared by scores and notifications, independent of who saw whom. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
