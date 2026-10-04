// The app reports that it sent the one-time first text to this person's Photon
// line (see photon_line in /api/app/me). The server then sends the "match texts
// are on" confirmation, which Photon accepts once that first text has arrived.
import { handler, HttpError, json, readJson, requireAccount } from "@/lib/auth";
import { accountById, db } from "@/lib/db";
import { confirmTexts } from "@/lib/muse-session";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const account = (await requireAccount(request));
  const body = await readJson(request);
  if (!account.photon_line || body.line !== account.photon_line) throw new HttpError(400, "That isn't this account's Photon line.");
  (await db().prepare("UPDATE accounts SET first_text_at = ? WHERE id = ?").run(Date.now(), account.id));
  console.log(`First text to Photon sent for ${account.username ?? account.id}`);
  confirmTexts((await accountById(account.id))!);
  return json({ ok: true });
});
