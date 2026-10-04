// Phone onboarding, step 1: {identifier, phone_number, consent, auto_approve} -> {login_id, step}.
// With MOCK_MUSE=true, also accepts mock_username and finishes immediately.
import { handler, HttpError, json, readJson } from "@/lib/auth";
import { config } from "@/lib/config";
import { mockLogin, startLogin } from "@/lib/muse-session";
import { isValidUsername } from "@/lib/profiles";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = handler(async request => {
  const body = await readJson(request);
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const phone = normalizeUsPhone(typeof body.phone_number === "string" ? body.phone_number : "");
  if (!identifier || identifier.length > 254) throw new HttpError(400, "Enter the email or mobile number of your Muse account.");
  if (!phone) throw new HttpError(400, "Enter your 10-digit US phone number.");
  if (typeof body.consent !== "boolean") throw new HttpError(400, "Say whether we may text you about matches.");
  if (body.auto_approve !== undefined && typeof body.auto_approve !== "boolean") throw new HttpError(400, "auto_approve must be true or false.");
  // Harmonize needs both: texts are how matches are delivered, and the approval
  // lets the server finish Muse's setup without the person tapping in Muse.
  if (body.consent !== true || body.auto_approve !== true) {
    throw new HttpError(400, "Turn on \"Text me about matches\" and tick the approval box to continue.");
  }
  if (body.use_dms !== undefined && typeof body.use_dms !== "boolean") throw new HttpError(400, "use_dms must be true or false.");
  const input = { identifier, phone_number: phone, consent: body.consent, auto_approve: body.auto_approve === true, use_dms: body.use_dms === true };

  if (config.mockMuse && body.mock_username !== undefined) {
    if (!isValidUsername(body.mock_username)) throw new HttpError(400, "mock_username must be a valid Instagram username.");
    return json({ step: "ready", ...(await mockLogin(input, body.mock_username)) });
  }
  return json(await startLogin(input));
});

/** US numbers are the default: "5551234567", "(555) 123-4567" and "15551234567" all become +15551234567. */
function normalizeUsPhone(raw: string): string | null {
  if (raw.trim().startsWith("+")) {
    const digits = raw.replace(/[^\d]/g, "");
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
