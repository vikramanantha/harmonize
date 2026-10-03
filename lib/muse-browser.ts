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

export async function withPage<T>(connectUrl: string, action: (page: Page) => Promise<T>) {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const context = browser.contexts()[0];
    const page = context.pages().at(-1) ?? await context.newPage();
    page.setDefaultTimeout(15_000);
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
  await composer.fill(prompt);
  const send = process.env.MUSE_SEND_SELECTOR
    ? page.locator(process.env.MUSE_SEND_SELECTOR).first()
    : page.getByRole("button", { name: /^(send|send message|submit)$/i }).first();
  if (await send.isVisible()) await send.click();
  else await composer.press("Enter");
  // A cleared composer is the acknowledgement that the UI accepted submission.
  await page.waitForFunction((selector) => {
    const element = document.querySelector(selector);
    return element instanceof HTMLTextAreaElement ? element.value === "" : element?.textContent === "";
  }, process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]');
}
