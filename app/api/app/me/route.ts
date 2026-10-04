// The phone's view of its account: profile status, settings, and matches.
import { handler, json, requireAccount } from "@/lib/auth";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { matchesFor } from "@/lib/matching";
import { failIfTimedOut } from "@/lib/muse-session";

export const runtime = "nodejs";

export const GET = handler(async request => {
  const account = failIfTimedOut(requireAccount(request));
  const username = account.username;
  const done = !config.loop && !!username &&
    db().prepare("SELECT 1 FROM notifications WHERE username = ? AND status = 'sent' LIMIT 1").get(username);
  return json({
    profile_status: account.profile_status,
    profile_error: account.profile_error,
    refresh_error: account.refresh_error,
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
