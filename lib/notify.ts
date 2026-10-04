// Texting matched users. NOTIFIER=photon sends iMessages through Photon's
// spectrum-ts SDK (https://photon.codes/docs, Stable); NOTIFIER=log prints them.
import { config } from "./config";

export class NotifyError extends Error {}

export interface Notifier {
  /** Sends [text] to an E.164 phone number. Throws on any failure. */
  send(phoneNumber: string, text: string): Promise<{ message_id?: string }>;
}

const logNotifier: Notifier = {
  async send(phoneNumber, text) {
    console.log(`[NOTIFIER=log] would text ${phoneNumber}: ${text}`);
    return {};
  },
};

// One Spectrum connection per server process, opened on first use.
const globalState = globalThis as typeof globalThis & { harmonyPhoton?: Promise<Notifier> };

async function photonNotifier(): Promise<Notifier> {
  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET;
  if (!projectId || !projectSecret) throw new NotifyError("SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET must be set in .env (Photon dashboard > project Settings).");
  const [{ Spectrum }, { imessage }] = await Promise.all([import("spectrum-ts"), import("spectrum-ts/providers/imessage")]);
  const app = await Spectrum({ projectId, projectSecret, providers: [imessage.config()] });
  const im = imessage(app);
  return {
    async send(phoneNumber, text) {
      const user = await im.user(phoneNumber);
      const dm = await im.space.create(user);
      const message = await dm.send(text);
      if (!message) throw new NotifyError(`Photon did not accept the message to ${phoneNumber}.`);
      return { message_id: message.id };
    },
  };
}

export function notifier(): Notifier {
  if (config.notifier === "log") return logNotifier;
  globalState.harmonyPhoton ??= photonNotifier().catch(error => {
    delete globalState.harmonyPhoton; // so the next send retries the connection
    throw error;
  });
  const pending = globalState.harmonyPhoton;
  return {
    async send(phoneNumber, text) {
      return (await pending).send(phoneNumber, text);
    },
  };
}

/**
 * Adds [phoneNumber] to the Photon project's Users list. On Photon's Free/Pro
 * (shared-pool) plans a project can only text registered users; anyone else is
 * rejected with "Target not allowed for this project". Safe to call again: the
 * same number returns the same user and updates the name.
 * Spectrum API "Create user": https://spectrum.photon.codes/openapi/json
 */
export async function registerRecipient(phoneNumber: string, name: string | null): Promise<{ line: string }> {
  const projectId = process.env.SPECTRUM_PROJECT_ID;
  const projectSecret = process.env.SPECTRUM_PROJECT_SECRET;
  if (!projectId || !projectSecret) throw new NotifyError("SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET must be set in .env.");
  const [firstName, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const response = await fetch(`https://spectrum.photon.codes/projects/${encodeURIComponent(projectId)}/users/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "shared",
      phoneNumber,
      ...(firstName ? { firstName } : {}),
      ...(rest.length ? { lastName: rest.join(" ") } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | { succeed?: boolean; message?: string; error?: string; data?: { assignedPhoneNumber?: string } }
    | null;
  if (!response.ok || !body?.succeed) {
    throw new NotifyError(`Photon refused to register ${phoneNumber} (${response.status}): ${body?.message ?? body?.error ?? JSON.stringify(body)}`);
  }
  const line = body.data?.assignedPhoneNumber;
  if (!line) throw new NotifyError(`Photon registered ${phoneNumber} but returned no assigned line.`);
  // The person must text this line once before Photon may text them
  // (shared-pool rule); the apps send that first text (photon_line in /api/app/me).
  return { line };
}

const CONFIRM_TEXT = "Harmonize: match texts are on! We'll text you when someone nearby watches the same kind of reels as you.";
const CONFIRM_ATTEMPTS = 6;
const CONFIRM_RETRY_MS = 10_000;

/**
 * Sends the "match texts are on" confirmation. Photon only accepts it after the
 * person's first text to their line has arrived, which can take a few seconds
 * after the phone sends it, so this waits and tries again a few times. Returns
 * the last error if it never goes through.
 */
export async function sendTextsConfirmation(phoneNumber: string): Promise<string | null> {
  let last = "";
  for (let attempt = 1; attempt <= CONFIRM_ATTEMPTS; attempt++) {
    try {
      await notifier().send(phoneNumber, CONFIRM_TEXT);
      return null;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      if (!/target not allowed/i.test(last)) break; // anything else won't fix itself by waiting
      await new Promise(resolve => setTimeout(resolve, CONFIRM_RETRY_MS));
    }
  }
  return last;
}

