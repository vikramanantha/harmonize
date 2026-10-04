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

/**
 * Login screens Harmonize knows how to fill:
 *   code      a code sent to the email (or phone) the person signed in with
 *   sms_code  a two-factor code texted to the account's phone
 *   phone     two-factor asks for the account's phone number first
 *   password
 *   ready     logged in (the chat box is showing)
 */
export type LoginStep = "code" | "sms_code" | "phone" | "password" | "ready";

export const CODE_FIELDS = 'input[autocomplete="one-time-code"], input[name*="code" i], input[placeholder*="code" i], input[inputmode="numeric"]';
export const PHONE_FIELDS = 'input[type="tel"], input[autocomplete="tel"], input[name*="phone" i], input[placeholder*="phone" i]';
export const PASSWORD_FIELDS = 'input[type="password"]';

// Wording that marks a code screen as a texted two-factor code rather than the
// email code: SMS/text words, or a masked phone number like "(•••) •••-1234",
// "***-1234" or "ending in 34" (an email mask like "v***@gmail.com" doesn't match).
const SMS_HINT = /text message|\bsms\b|texted|two-factor|2-factor|two-step|2-step|\b2fa\b|ending in \d|[•*]{2,}[\s-]*\d{2,4}\b|\(\d{3}\)/i;

export async function pageText(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 1500);
}

async function isMethodChooser(page: Page): Promise<boolean> {
  const next = page.getByRole("button", { name: /^\s*next\s*$/i }).first();
  if (!(await next.isVisible().catch(() => false))) return false;
  return /select a method|authentication method|confirm your meta account/i.test(await pageText(page));
}

export async function nextStep(page: Page): Promise<LoginStep> {
  const code = page.locator(CODE_FIELDS);
  const phone = page.locator(PHONE_FIELDS);
  const password = page.locator(PASSWORD_FIELDS);
  const composer = page.locator(process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]');
  let choseMethod = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    // Meta's "Confirm your Meta Account" screen: pick how to get the two-step
    // code ("Send SMS to +*******7110" or "Original Device (Authenticator App)")
    // and press Next. There's nothing to type, so the server picks SMS itself;
    // the texted code then comes back to the person as the sms_code step.
    if (await isMethodChooser(page)) {
      if (choseMethod) throw new MuseError("Meta's two-step sign-in screen didn't move on after choosing \"Send SMS\".");
      const sms = page.getByText(/send sms to/i).first();
      if (!(await sms.isVisible().catch(() => false))) {
        throw new MuseError("Meta asked how to confirm your account, but didn't offer a text message (SMS) option.");
      }
      await sms.click();
      await page.getByRole("button", { name: /^\s*next\s*$/i }).first().click();
      choseMethod = true;
      await page.waitForTimeout(2500);
      continue;
    }
    if (await code.first().isVisible()) return SMS_HINT.test(await pageText(page)) ? "sms_code" : "code";
    if (await phone.first().isVisible()) return "phone";
    if (await password.first().isVisible()) return "password";
    if (new URL(page.url()).hostname === "muse.ai" && await composer.first().isVisible()) return "ready";
    await page.waitForTimeout(500);
  }
  // Unknown screen: keep a screenshot so the step can be added, and say what it showed.
  const shot = `data/debug/muse-${Date.now()}.png`;
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const text = (await pageText(page)).slice(0, 200);
  console.error(`Unrecognized Muse login screen (screenshot: ${shot}): ${text}`);
  throw new MuseError(`Muse showed a sign-in step Harmonize doesn't recognize yet: "${text}"`);
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
  return approveCard(page, new RegExp(`allow muse to share information with\\s+${host.replace(/[.]/g, "\\.")}`, "i"), host, done, timeoutMs);
}

/**
 * Same as approveSite, for Muse's permission card about Instagram messages (for
 * people who ticked "Include reels from my Instagram messages"). Only a card
 * that names Instagram and asks to allow Muse is touched.
 */
export async function approveInstagram(page: Page, done: () => boolean, timeoutMs: number): Promise<boolean> {
  return approveCard(page, /allow muse\b.*instagram|instagram.*\ballow muse/i, "Instagram", done, timeoutMs);
}

async function approveCard(page: Page, cardText: RegExp, what: string, done: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !done()) {
    const card = page.getByText(cardText).first();
    if (await card.isVisible().catch(() => false)) {
      // Exact name: a looser match also hits the card itself (its name contains
      // every button label), and clicking that lands on "Allow once".
      const always = page.getByRole("button", { name: /^\s*always allow(\s+this\s+(site|app|connection|integration))?\s*$/i });
      if (await always.count() !== 1) {
        throw new MuseError(`Muse showed an approval card for ${what}, but not exactly one "Always allow" button (found ${await always.count()}).`);
      }
      await always.click();
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

