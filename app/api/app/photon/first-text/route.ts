// The app reports that it sent the one-time first text to this person's Photon
// line (see photon_line in /api/app/me). Only recorded for display; Photon itself
// is what checks it.
import { handler, HttpError, json, readJson, requireAccount } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const account = requireAccount(request);
  const body = await readJson(request);
  if (!account.photon_line || body.line !== account.photon_line) throw new HttpError(400, "That isn't this account's Photon line.");
  db().prepare("UPDATE accounts SET first_text_at = ? WHERE id = ?").run(Date.now(), account.id);
  console.log(`First text to Photon sent for ${account.username ?? account.id}`);
  return json({ ok: true });
});
