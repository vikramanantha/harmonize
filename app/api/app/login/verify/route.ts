// Phone onboarding, step 2: {login_id, credential} -> {step} or {step: "ready", device_token}.
import { handler, HttpError, json, readJson } from "@/lib/auth";
import { verifyLogin } from "@/lib/muse-session";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = handler(async request => {
  const body = await readJson(request);
  if (typeof body.login_id !== "string" || !body.login_id) throw new HttpError(400, "Missing login_id.");
  if (typeof body.credential !== "string" || !body.credential || body.credential.length > 512) throw new HttpError(400, "Enter the requested code or password.");
  return json(await verifyLogin(body.login_id, body.credential));
});
