// Daily Instagram-summary refresh: re-sends the Muse prompt for every account
// whose summary is older than SUMMARY_REFRESH_MS. Started once per server
// process from instrumentation.ts.
import { config } from "./config";
import { db, type Account } from "./db";
import { sendSummaryPrompt } from "./muse-session";

const CHECK_EVERY_MS = 10 * 60_000;
const globalState = globalThis as typeof globalThis & { harmonyRefreshTimer?: NodeJS.Timeout };

export function startRefreshScheduler() {
  if (globalState.harmonyRefreshTimer || config.mockMuse) return;
  globalState.harmonyRefreshTimer = setInterval(() => void refreshDueAccounts(), CHECK_EVERY_MS);
  globalState.harmonyRefreshTimer.unref();
}

export async function refreshDueAccounts() {
  const due = (await db().prepare(`
    SELECT * FROM accounts
    WHERE profile_status = 'ready' AND summarized_at < ?
      AND (prompted_at IS NULL OR prompted_at < ?)   -- not already waiting on a callback
  `).all(Date.now() - config.summaryRefreshMs, Date.now() - config.museCallbackTimeoutMs)) as Account[];
  for (const account of due) await refreshAccount(account);
}

export async function refreshAccount(account: Account) {
  try {
    await sendSummaryPrompt(account);
    console.log(`Summary refresh prompted for ${account.username}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Summary refresh failed for ${account.username}: ${message}`);
    // Keeps the existing profile usable; the error shows in the app.
    (await db().prepare("UPDATE accounts SET refresh_error = ?, summarized_at = ? WHERE id = ?").run(message, Date.now(), account.id));
  }
}
