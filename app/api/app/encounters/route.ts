// The phone read another user's username over Bluetooth: {other_username} -> EncounterResult.
import { handler, HttpError, json, readJson, requireAccount } from "@/lib/auth";
import { handleEncounter } from "@/lib/matching";
import { isValidUsername } from "@/lib/spacetime";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async request => {
  const account = requireAccount(request);
  const body = await readJson(request);
  if (!isValidUsername(body.other_username)) throw new HttpError(400, "other_username must be a valid Instagram username.");
  if (account.profile_status !== "ready") throw new HttpError(409, account.profile_error ?? "Your profile is not ready yet.");
  return json(await handleEncounter(account, body.other_username));
});
