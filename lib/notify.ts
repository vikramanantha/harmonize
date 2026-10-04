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
