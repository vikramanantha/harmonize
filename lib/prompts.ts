// The Muse prompt lives in muse_agent_prompt.txt at the repo root so teammates
// can edit it without touching code. The server fills in the callback details.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

export const PROMPT_FILE = "muse_agent_prompt.txt";

/**
 * The one message Muse gets after sign-up (and for the daily refresh). It
 * explains itself first: Muse rightly refuses an unexplained command to an
 * unknown URL. With [checkToken], it starts with a connection test that sends
 * only placeholder values, so Muse's one-time "Allow … to share information"
 * card for this server appears early, while the server's browser can accept it.
 */
export function buildMusePrompt(callbackToken: string, options: { checkToken?: string; useDms: boolean }): string {
  const { checkToken, useDms } = options;
  const template = readFileSync(join(process.cwd(), PROMPT_FILE), "utf8");
  for (const placeholder of ["{{CALLBACK_URL}}", "{{CALLBACK_TOKEN}}", "{{SERVER_URL}}", "{{SETUP_STEP}}", "{{REELS_SOURCES}}"]) {
    if (!template.includes(placeholder)) throw new Error(`${PROMPT_FILE} is missing the ${placeholder} placeholder`);
  }
  const setupStep = checkToken
    ? [
      "",
      "FIRST: CONNECTION TEST",
      "Before reading Instagram, check that Harmonize's server is reachable with this one command. It sends only placeholder test values, nothing about me. It should answer {\"ok\":true}; then continue with the job below.",
      "",
      `curl -sS -X POST "${config.publicUrl}/api/app/muse/setup-check" -H "Content-Type: application/json" -d '{"check":"${checkToken}","name":"Setup Check","username":"setup.check","summary":"Placeholder test values, not real data."}'`,
      "",
    ].join("\n")
    : "";
  // DMs only with the person's opt-in, and only if Muse already has Instagram
  // Messages connected: never ask the person to connect it or to confirm.
  const reelsSources = useDms
    ? "Read my liked reels and saved reels. If Instagram Messages is already connected for you, also include reels shared in my " +
      "DMs (only the reels, never the conversation text or who I talk to). If it isn't connected, skip DMs: don't ask me about " +
      "them and don't ask me to connect anything."
    : "Read my liked reels and saved reels. Don't open my Instagram messages.";
  return template
    .replaceAll("{{REELS_SOURCES}}", reelsSources)
    .replaceAll("{{SERVER_URL}}", config.publicUrl)
    .replaceAll("{{SETUP_STEP}}", setupStep)
    .replaceAll("{{CALLBACK_URL}}", `${config.publicUrl}/api/app/muse/callback`)
    .replaceAll("{{CALLBACK_TOKEN}}", callbackToken);
}
