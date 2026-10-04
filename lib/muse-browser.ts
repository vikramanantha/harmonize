import { chromium, type Page } from "playwright-core";

const API = "https://api.browserbase.com/v1/sessions";
export class MuseError extends Error {}

export async function browserbase(path: string, body: object) {
  const key = process.env.BROWSERBASE_API_KEY;
  if (!key) throw new MuseError("BROWSERBASE_API_KEY is missing on the server.");
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "X-BB-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new MuseError(`Browserbase request failed (${response.status}).`);
  return response.json();
}

export async function release(id: string) {
  await browserbase(`/${encodeURIComponent(id)}`, { status: "REQUEST_RELEASE" });
}

/**
 * A Browserbase context is a saved browser profile (cookies included). Logging
 * in to Muse inside a session that persists to a context keeps the login for
 * later sessions, so the daily summary prompt needs no new verification code.
 * https://docs.browserbase.com/features/contexts
 */
export async function createContext(name: string): Promise<string> {
  const key = process.env.BROWSERBASE_API_KEY;
  if (!key) throw new MuseError("BROWSERBASE_API_KEY is missing on the server.");
  const response = await fetch("https://api.browserbase.com/v1/contexts", {
    method: "POST",
    headers: { "X-BB-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...(process.env.BROWSERBASE_PROJECT_ID ? { projectId: process.env.BROWSERBASE_PROJECT_ID } : {}) }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new MuseError(`Browserbase context creation failed (${response.status}).`);
  const context = (await response.json()) as { id?: string };
  if (!context.id) throw new MuseError("Browserbase returned no context id.");
  return context.id;
}

/** A session whose cookies are loaded from, and saved back to, [contextId]. */
export async function createSession(contextId: string): Promise<{ id: string; connectUrl: string }> {
  const session = await browserbase("", {
    timeout: 600,
    keepAlive: true,
    ...(process.env.BROWSERBASE_PROJECT_ID ? { projectId: process.env.BROWSERBASE_PROJECT_ID } : {}),
    browserSettings: { recordSession: false, logSession: false, context: { id: contextId, persist: true } },
  });
  if (!session.id || !session.connectUrl) throw new MuseError("Browserbase returned no session.");
  return { id: session.id, connectUrl: session.connectUrl };
}

export async function withPage<T>(connectUrl: string, action: (page: Page) => Promise<T>) {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const context = browser.contexts()[0];
    const page = context.pages().at(-1) ?? await context.newPage();
    page.setDefaultTimeout(45_000); // Muse's page can take a while to react
    return await action(page);
  } finally {
    await browser.close();
  }
}

export async function nextStep(page: Page): Promise<"code" | "password" | "ready"> {
  const code = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[placeholder*="code" i], input[inputmode="numeric"]');
  const password = page.locator('input[type="password"]');
  const composer = page.locator(process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]');
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await code.first().isVisible()) return "code";
    if (await password.first().isVisible()) return "password";
    if (new URL(page.url()).hostname === "muse.ai" && await composer.first().isVisible()) return "ready";
    await page.waitForTimeout(500);
  }
  throw new MuseError("Muse did not show a supported login step. It may require a CAPTCHA, SSO, or account setup. Cancel and try again.");
}

export async function submitPrompt(page: Page, prompt: string) {
  if (new URL(page.url()).hostname !== "muse.ai") throw new MuseError("Muse login has not completed.");
  const composer = page.locator(process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]').first();
  // Muse's editor ignores fill(): the text appears but Send stays disabled. Typing
  // through the keyboard API fires the input events the editor listens for.
  await composer.click();
  await page.keyboard.insertText(prompt);
  const send = process.env.MUSE_SEND_SELECTOR
    ? page.locator(process.env.MUSE_SEND_SELECTOR).first()
    : page.getByRole("button", { name: /^(send|send message|submit)$/i }).first();
  if (await send.isVisible()) {
    try {
      await page.waitForFunction(el => el?.getAttribute("aria-disabled") !== "true" && !(el as HTMLButtonElement).disabled, await send.elementHandle(), { timeout: 10_000 });
    } catch {
      throw new MuseError("Muse's Send button stayed disabled after typing the prompt, so the prompt was not sent.");
    }
    await send.click();
  } else {
    await composer.press("Enter");
  }
  // A cleared composer is the acknowledgement that the UI accepted submission.
  await page.waitForFunction((selector) => {
    const element = document.querySelector(selector);
    return element instanceof HTMLTextAreaElement ? element.value === "" : element?.textContent === "";
  }, process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]');
}

/**
 * Waits for Muse's "Allow Muse to share information with <host>?" card for
 * exactly [host] and clicks "Always allow this site". Cards for any other site
 * are left alone. Returns true if it clicked, false if [done] became true first
 * (the site was already allowed) or [timeoutMs] passed.
 */
export async function approveSite(page: Page, host: string, done: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !done()) {
    const card = page.getByText(new RegExp(`allow muse to share information with\\s+${host.replace(/[.]/g, "\\.")}`, "i")).first();
    if (await card.isVisible().catch(() => false)) {
      // Exact name: a looser match also hits the card itself (its name contains
      // every button label), and clicking that lands on "Allow once".
      const always = page.getByRole("button", { name: /^\s*always allow this site\s*$/i });
      if (await always.count() !== 1) {
        throw new MuseError(`Muse showed an approval card for ${host}, but not exactly one "Always allow this site" button (found ${await always.count()}).`);
      }
      await always.click();
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

