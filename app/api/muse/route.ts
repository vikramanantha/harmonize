import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { browserbase, MuseError, nextStep, release, submitPrompt, withPage, type LoginStep } from "@/lib/muse-browser";

export const runtime = "nodejs";
export const maxDuration = 120;
type Login = { id: string; connectUrl: string; prompt: string; step: LoginStep; expires: number; busy: boolean };
const globalState = globalThis as typeof globalThis & { museLogins?: Map<string, Login> };
const logins = globalState.museLogins ??= new Map<string, Login>();
const COOKIE = "muse_login";
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Expected JSON." }, 415);
  if (Number(request.headers.get("content-length")) > 16000) return json({ error: "Request too large." }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400);
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  let login = token ? logins.get(token) : undefined;
  for (const [key, value] of logins) if (value.expires < Date.now() && !value.busy) {
    logins.delete(key);
    void release(value.id).catch(() => {});
  }
  if (login?.busy) return json({ error: "A browser action is already running." }, 409);
  if (body.action === "cancel") {
    if (login) { await release(login.id).catch(() => {}); logins.delete(token!); }
    jar.delete(COOKIE);
    return json({ message: "Session closed." });
  }
  if (!["start", "verify"].includes(body.action)) return json({ error: "Invalid action." }, 400);
  if (body.action === "start" && (typeof body.identifier !== "string" || !body.identifier.trim() || body.identifier.length > 254 || typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 8000)) return json({ error: "Enter an email or mobile number and a prompt (up to 8,000 characters)." }, 400);
  if (body.action === "verify" && (typeof body.credential !== "string" || !body.credential || body.credential.length > 512)) return json({ error: "Enter the requested code or password." }, 400);
  let stage = "creating the Browserbase session";
  try {
    if (body.action === "start") {
      if (login) { await release(login.id); logins.delete(token!); }
      if (logins.size >= 5) return json({ error: "All browser slots are busy. Try again shortly." }, 429);
      const session = await browserbase("", { timeout: 600, keepAlive: true, ...(process.env.BROWSERBASE_PROJECT_ID ? { projectId: process.env.BROWSERBASE_PROJECT_ID } : {}), browserSettings: { recordSession: false, logSession: false } });
      login = { id: session.id, connectUrl: session.connectUrl, prompt: body.prompt.trim(), step: "code", expires: Date.now() + 540_000, busy: true };
      const newToken = randomUUID();
      logins.set(newToken, login);
      jar.set(COOKIE, newToken, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 540, path: "/api/muse" });
      stage = "connecting to the remote browser";
      login.step = await withPage(login.connectUrl, async page => {
        stage = "opening Muse";
        await page.goto("https://muse.ai/", { waitUntil: "domcontentloaded" });
        stage = "finding Muse's email/mobile field";
        await page.getByPlaceholder("Mobile number or email", { exact: true }).fill(body.identifier.trim());
        stage = "clicking Muse's Continue button";
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        stage = "waiting for Muse's verification screen";
        await page.waitForTimeout(1500);
        return nextStep(page);
      });
    } else {
      if (!login || login.expires < Date.now()) return json({ error: "Session expired. Start again." }, 410);
      login.busy = true;
      const current = login;
      stage = "reconnecting to the login browser";
      login.step = await withPage(login.connectUrl, async page => {
        stage = "finding Muse's verification field";
        const fields = page.locator(current.step === "password" ? 'input[type="password"]' : 'input[autocomplete="one-time-code"], input[name*="code" i], input[placeholder*="code" i], input[inputmode="numeric"]');
        const count = await fields.count();
        if (count > 1 && current.step === "code") {
          if (body.credential.length !== count) throw new MuseError(`Enter the ${count}-digit verification code.`);
          for (let i = 0; i < count; i++) await fields.nth(i).fill(body.credential[i]);
        } else await fields.first().fill(body.credential);
        stage = "submitting Muse's verification form";
        const submit = page.getByRole("button", { name: /^(continue|verify|verify code|log in|sign in|submit)$/i }).first();
        if (await submit.isVisible() && await submit.isEnabled()) await submit.click();
        await page.waitForTimeout(1500);
        stage = "waiting for Muse to finish login";
        return nextStep(page);
      });
    }
    if (login.step === "ready") {
      stage = "submitting your prompt to Muse";
      await withPage(login.connectUrl, page => submitPrompt(page, login!.prompt));
      await release(login.id).catch(() => {});
      for (const [key, value] of logins) if (value === login) logins.delete(key);
      jar.delete(COOKIE);
      return json({ step: "done", message: "Logged in and submitted your prompt to Muse." });
    }
    return json({ step: login.step, message: login.step === "code" ? "Enter the verification code Muse sent to your email or phone." : "Muse is asking for your password." });
  } catch (error) {
    // Playwright error messages may contain filled credentials or CDP URLs.
    // Log only a fixed stage and a classified error type.
    const kind = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "browser/network error";
    console.error("Muse browser action failed", { stage, kind });
    if (login && (body.action === "start" || login.step === "ready")) {
      await release(login.id).catch(() => {});
      for (const [key, value] of logins) if (value === login) logins.delete(key);
      jar.delete(COOKIE);
    }
    return json({ error: error instanceof MuseError ? error.message : `Failed while ${stage} (${kind}). Cancel and start again.` }, 502);
  } finally {
    if (login) login.busy = false;
  }
}
