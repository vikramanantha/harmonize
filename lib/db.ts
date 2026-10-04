// Server-only Neon Postgres storage for accounts, sessions and matching state.
import { createHash, randomBytes } from 'node:crypto';
import { database } from './neon';

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
  texts_confirmed_at: number | null;
  summary: string | null;
  use_dms: number;
  created_at: number;
};

export type Login = {
  id: string;
  identifier: string;
  phone_number: string;
  consent: number;
  auto_approve: number;
  use_dms: number;
  session_id: string;
  connect_url: string;
  context_id: string;
  step: import("./muse-browser").LoginStep;
  busy: number;
  expires: number;
};

/** Async prepared queries; values are always bound separately from SQL. */
export function db() {
  return {
    prepare(query: string) {
      let index = 0;
      const sql = query.replace(/\?/g, () => '$' + (++index));
      return {
        async get(...values: unknown[]) { return (await database().query(sql, values))[0]; },
        async all(...values: unknown[]) { return await database().query(sql, values); },
        async run(...values: unknown[]) {
          const result = await database().query(sql, values, { fullResults: true });
          return { changes: result.rowCount };
        },
      };
    },
  };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

export async function accountByToken(token: string): Promise<Account | null> {
  return ((await db().prepare("SELECT * FROM accounts WHERE device_token_hash = ?").get(hashToken(token))) as Account | undefined) ?? null;
}

export async function accountById(id: number): Promise<Account | null> {
  return ((await db().prepare("SELECT * FROM accounts WHERE id = ?").get(id)) as Account | undefined) ?? null;
}

export async function accountByUsername(username: string): Promise<Account | null> {
  return ((await db().prepare("SELECT * FROM accounts WHERE username = ?").get(username)) as Account | undefined) ?? null;
}

export async function accountByCallbackToken(token: string): Promise<Account | null> {
  return ((await db().prepare("SELECT * FROM accounts WHERE callback_token = ?").get(token)) as Account | undefined) ?? null;
}

/** Creates the account on first login, or re-issues a device token on a later one. Returns the plain token. */
export async function upsertAccount(fields: { identifier: string; phone_number: string; consent: boolean; use_dms?: boolean; browserbase_context_id: string | null }): Promise<{ account: Account; deviceToken: string }> {
  const token = newToken();
  (await db().prepare(`
    INSERT INTO accounts (identifier, phone_number, consent, use_dms, device_token_hash, browserbase_context_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (identifier) DO UPDATE SET
      phone_number = excluded.phone_number,
      consent = excluded.consent,
      use_dms = excluded.use_dms,
      device_token_hash = excluded.device_token_hash,
      browserbase_context_id = excluded.browserbase_context_id
  `).run(fields.identifier, fields.phone_number, fields.consent ? 1 : 0, fields.use_dms ? 1 : 0, hashToken(token), fields.browserbase_context_id, Date.now()));
  const account = (await db().prepare("SELECT * FROM accounts WHERE identifier = ?").get(fields.identifier)) as Account;
  return { account, deviceToken: token };
}

/** Pair key shared by scores and notifications, independent of who saw whom. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
