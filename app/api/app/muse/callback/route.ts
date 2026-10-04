// Muse calls this with its result (see muse_agent_prompt.txt); the server writes
// it to Neon, so Muse only ever contacts this one URL:
// {token, name, username, summary} -> {ok: true}
import { handler, HttpError, json, readJson } from "@/lib/auth";
import { accountByCallbackToken } from "@/lib/db";
import { completeProfile } from "@/lib/muse-session";
import { isValidUsername } from "@/lib/profiles";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const body = await readJson(request);
  if (typeof body.token !== "string" || !body.token) throw new HttpError(400, "Missing token.");
  const account = (await accountByCallbackToken(body.token));
  if (!account) throw new HttpError(404, "Unknown or already-used token.");
  if (!isValidUsername(body.username)) throw new HttpError(400, "username must be a valid Instagram username.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) throw new HttpError(400, "name must be 1-100 characters.");
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (summary.length < 20 || summary.length > 2000) throw new HttpError(400, "summary must be 20-2000 characters.");
  await completeProfile(account, body.username, name, summary);
  console.log(`Profile ready for ${body.username}`);
  return json({ ok: true });
});
