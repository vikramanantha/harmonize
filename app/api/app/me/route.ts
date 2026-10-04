// The phone's view of its account: profile status, settings, and matches.
import { handler, json, requireAccount } from "@/lib/auth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { matchesFor } from "@/lib/matching";
import { failIfTimedOut, registerForTexts } from "@/lib/muse-session";
import { accountById } from "@/lib/db";
import { tasteProfileByUsername } from "@/lib/spacetime";

export const runtime = "nodejs";

export const GET = handler(async request => {
  let account = failIfTimedOut(requireAccount(request));
  // Accounts that became ready before the server kept a copy of the summary.
  if (account.profile_status === "ready" && account.username && !account.summary) {
    const profile = await tasteProfileByUsername(account.username);
    if (profile) {
      db().prepare("UPDATE accounts SET summary = ? WHERE id = ?").run(profile.summary, account.id);
      account = { ...account, summary: profile.summary };
    }
  }
  // Accounts that became ready before Photon was on get registered here, once.
  if (account.profile_status === "ready" && account.consent && config.notifier === "photon" && !account.photon_line && !account.photon_error) {
    await registerForTexts(account);
    account = accountById(account.id) ?? account;
  }
  const username = account.username;
  const done = !config.loop && !!username &&
    db().prepare("SELECT 1 FROM notifications WHERE username = ? AND status = 'sent' LIMIT 1").get(username);
  return json({
    profile_status: account.profile_status,
    profile_error: account.profile_error,
    refresh_error: account.refresh_error,
    photon_error: account.photon_error,
    // The app texts this number once (Android automatically, iPhone with one tap)
    // so Photon is allowed to text this person; null when texts are off.
    photon_line: account.consent ? account.photon_line : null,
    texts_confirmed_at: account.texts_confirmed_at,
    summary: account.summary,
    first_text_at: account.first_text_at,
    username,
    name: account.name,
    phone_number: account.phone_number,
    consent: account.consent === 1,
    summarized_at: account.summarized_at,
    loop: config.loop,
    match_threshold: config.matchThreshold,
    done: !!done,
    matches: username ? matchesFor(username) : [],
  });
});
