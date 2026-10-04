// Muse's test POST during the post-login setup check (see buildSetupCheckPrompt).
// It sends data the same way the real callback does, so Muse shows its one-time
// "Allow Muse to share information with <this server>?" card here. Recording the
// arrival tells the server the site is approved.
import { handler, HttpError, json, readJson } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const body = await readJson(request);
  if (typeof body.check !== "string" || !body.check) throw new HttpError(400, "Missing check.");
  const result = db().prepare("UPDATE setup_checks SET received_at = ? WHERE token = ? AND received_at IS NULL").run(Date.now(), body.check);
  if (result.changes === 0) throw new HttpError(404, "Unknown or already-used check.");
  console.log("Muse setup check received");
  return json({ ok: true });
});
