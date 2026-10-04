// The Muse prompt lives in muse_agent_prompt.txt at the repo root so teammates
// can edit it without touching code. The server fills in the callback details.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

export const PROMPT_FILE = "muse_agent_prompt.txt";

export function buildMusePrompt(callbackToken: string): string {
  const template = readFileSync(join(process.cwd(), PROMPT_FILE), "utf8");
  for (const placeholder of ["{{CALLBACK_URL}}", "{{CALLBACK_TOKEN}}"]) {
    if (!template.includes(placeholder)) throw new Error(`${PROMPT_FILE} is missing the ${placeholder} placeholder`);
  }
  return template
    .replaceAll("{{CALLBACK_URL}}", `${config.publicUrl}/api/app/muse/callback`)
    .replaceAll("{{CALLBACK_TOKEN}}", callbackToken);
}

/**
 * Sent right after login when the user opted in to automatic approval: has Muse
 * POST test data to this server exactly the way the real prompt's callback
 * does, so Muse's one-time approval card for this server shows up while the
 * Browserbase browser is on the page and can accept it.
 */
export function buildSetupCheckPrompt(checkToken: string): string {
  return [
    "Harmony setup check. Send this test data to Harmony's server with exactly this one command, then reply with the server's answer and nothing else:",
    "",
    `curl -sS -X POST "${config.publicUrl}/api/app/muse/setup-check" -H "Content-Type: application/json" -d '{"check":"${checkToken}","name":"Setup Check","username":"setup.check","summary":"Test data so this connection gets approved before the real profile is sent."}'`,
  ].join("\n");
}

