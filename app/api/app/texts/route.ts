// The "Match texts" switch in the app: {enabled} -> {enabled, photon_line, photon_error}.
// Turning it on registers the number with Photon. The app then sends (or, if it
// already did, re-reports) the first text to photon_line, and that report
// (/api/app/photon/first-text) triggers the "match texts are on" confirmation.
import { handler, HttpError, json, readJson, requireAccount } from "@/lib/auth";
import { accountById, db } from "@/lib/db";
import { registerForTexts } from "@/lib/muse-session";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const account = (await requireAccount(request));
  const body = await readJson(request);
  if (typeof body.enabled !== "boolean") throw new HttpError(400, "enabled must be true or false.");
  (await db().prepare("UPDATE accounts SET consent = ?, photon_error = NULL, texts_confirmed_at = NULL WHERE id = ?").run(body.enabled ? 1 : 0, account.id));
  if (body.enabled) await registerForTexts({ ...account, consent: 1 });
  const result = (await accountById(account.id))!;
  return json({ enabled: result.consent === 1, photon_line: result.consent ? result.photon_line : null, photon_error: result.photon_error });
});
