// Muse login for the phone apps, and sending the Instagram-summary prompt.
//
// Login runs in a Browserbase session tied to a Browserbase context, so the
// Muse cookies survive. The prompt is sent in that same session right after
// login; later refreshes open a new session on the same context and expect to
// still be logged in. Nothing here retries or falls back: any step that doesn't
// go as expected throws, and the phone shows the message.
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { db, newToken, upsertAccount, type Account, type Login } from "./db";
import { approveInstagram, approveSite, browserbase, CODE_FIELDS, createContext, PASSWORD_FIELDS, PHONE_FIELDS, createSession, MuseError, nextStep, release, submitPrompt, withPage } from "./muse-browser";
import { registerRecipient, sendTextsConfirmation } from "./notify";
import { buildMusePrompt } from "./prompts";
import { saveTasteProfile, tasteProfileByUsername } from "./spacetime";

const LOGIN_TTL_MS = 540_000; // under Browserbase's 600 s session timeout
const MAX_PENDING_LOGINS = 5;
const CODE_ACCEPT_TIMEOUT_MS = 20_000;
const SETUP_CHECK_TIMEOUT_MS = 3 * 60_000;

async function alreadyLoggedIn(page: import("playwright-core").Page): Promise<boolean> {
  if (new URL(page.url()).hostname !== "muse.ai") return false;
  const composer = page.locator(process.env.MUSE_PROMPT_SELECTOR || 'textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"][data-lexical-editor="true"]');
  return composer.first().isVisible().catch(() => false);
}

export type LoginInput = { identifier: string; phone_number: string; consent: boolean; auto_approve: boolean; use_dms: boolean };

function loginById(id: string): Login | null {
  return (db().prepare("SELECT * FROM logins WHERE id = ?").get(id) as Login | undefined) ?? null;
}

function setStep(id: string, step: Login["step"]) {
  db().prepare("UPDATE logins SET step = ? WHERE id = ?").run(step, id);
}

function setBusy(id: string, busy: boolean) {
  db().prepare("UPDATE logins SET busy = ? WHERE id = ?").run(busy ? 1 : 0, id);
}

async function dropLogin(login: Login) {
  db().prepare("DELETE FROM logins WHERE id = ?").run(login.id);
  await release(login.session_id).catch(() => {});
}

async function expireLogins() {
  const expired = db().prepare("SELECT * FROM logins WHERE expires < ? AND busy = 0").all(Date.now()) as Login[];
  for (const login of expired) await dropLogin(login);
}

/** Step 1: opens Muse in a remote browser and submits the email/mobile. */
export async function startLogin(input: LoginInput): Promise<{ login_id: string; step: Login["step"] }> {
  await expireLogins();
  const pending = (db().prepare("SELECT COUNT(*) AS n FROM logins").get() as { n: number }).n;
  if (pending >= MAX_PENDING_LOGINS) throw new MuseError("All browser slots are busy. Try again shortly.");

  const contextId = await createContext(`harmony-${randomUUID()}`);
  const session = await createSession(contextId);
  const login: Login = {
    id: randomUUID(),
    identifier: input.identifier,
    phone_number: input.phone_number,
    consent: input.consent ? 1 : 0,
    auto_approve: input.auto_approve ? 1 : 0,
    use_dms: input.use_dms ? 1 : 0,
    session_id: session.id,
    connect_url: session.connectUrl,
    context_id: contextId,
    step: "code",
    busy: 1,
    expires: Date.now() + LOGIN_TTL_MS,
  };
  db().prepare(`INSERT INTO logins (id, identifier, phone_number, consent, auto_approve, use_dms, session_id, connect_url, context_id, step, busy, expires)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(login.id, login.identifier, login.phone_number, login.consent, login.auto_approve, login.use_dms, login.session_id, login.connect_url, login.context_id, login.step, 1, login.expires);

  try {
    const step = await withPage(session.connectUrl, async page => {
      await page.goto("https://muse.ai/", { waitUntil: "domcontentloaded" });
      await page.getByPlaceholder("Mobile number or email", { exact: true }).fill(input.identifier);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForTimeout(1500);
      return nextStep(page);
    });
    if (step === "ready") throw new MuseError("Muse logged in without asking for a code; this flow expects one.");
    setStep(login.id, step);
    return { login_id: login.id, step };
  } catch (error) {
    await dropLogin(login);
    throw error;
  } finally {
    setBusy(login.id, false);
  }
}

/**
 * Step 2: enters the code (or password). When Muse is logged in, creates the
 * account, sends the summary prompt in the same browser, and returns the device
 * token the phone uses from then on.
 */
export async function verifyLogin(loginId: string, credential: string): Promise<{ step: Login["step"]; device_token?: string }> {
  const login = loginById(loginId);
  if (!login || login.expires < Date.now()) throw new MuseError("Login expired. Start again.");
  if (login.busy) throw new MuseError("A browser action is already running.");
  setBusy(login.id, true);
  try {
    const step = await withPage(login.connect_url, async page => {
      // A previous Verify may have been accepted after the server stopped looking;
      // if Muse is already past the code screen, don't type the code again.
      if (await alreadyLoggedIn(page)) return "ready" as const;
      const isCode = login.step === "code" || login.step === "sms_code";
      const fields = page.locator(login.step === "password" ? PASSWORD_FIELDS : login.step === "phone" ? PHONE_FIELDS : CODE_FIELDS);
      const count = await fields.count();
      if (count > 1 && isCode) {
        if (credential.length !== count) throw new MuseError(`Enter the ${count}-digit verification code.`);
        for (let i = 0; i < count; i++) await fields.nth(i).fill(credential[i]);
      } else {
        await fields.first().fill(credential);
      }
      const submit = page.getByRole("button", { name: /^(continue|verify|verify code|log in|sign in|submit|next|confirm|send code|send|text me)$/i }).first();
      if (await submit.isVisible() && await submit.isEnabled()) await submit.click();
      // Muse keeps the code box on screen for a few seconds while it checks the
      // code; looking too early reports "still on the code step" for a code that
      // was accepted. Wait for the box to go away (or for a wrong-code timeout).
      await fields.first().waitFor({ state: "hidden", timeout: CODE_ACCEPT_TIMEOUT_MS }).catch(() => {});
      const next = await nextStep(page);
      if (next === login.step) {
        throw new MuseError(login.step === "phone"
          ? "Muse didn't accept that phone number. Use the one on your Muse account."
          : "Muse didn't accept that code. Check it and try again.");
      }
      return next;
    });
    if (step !== "ready") {
      setStep(login.id, step);
      return { step };
    }

    const { account, deviceToken } = upsertAccount({
      identifier: login.identifier,
      phone_number: login.phone_number,
      consent: login.consent === 1,
      use_dms: login.use_dms === 1,
      browserbase_context_id: login.context_id,
    });
    // A fresh login starts a fresh profile run: clear any failure left from an
    // earlier attempt, or the phone would show that old error while this one runs.
    db().prepare("UPDATE accounts SET profile_status = 'pending', profile_error = NULL, callback_token = NULL, prompted_at = ? WHERE id = ?")
      .run(Date.now(), account.id);
    db().prepare("DELETE FROM logins WHERE id = ?").run(login.id);
    // The rest takes minutes (Muse must contact each site so the approval cards
    // can be accepted), so it runs on after this request returns; the phone
    // polls GET /api/app/me meanwhile.
    void finishSetup(account, login);
    return { step: "ready", device_token: deviceToken };
  } catch (error) {
    if (error instanceof MuseError && /code|password/i.test(error.message)) throw error; // user can retry the code
    await dropLogin(login);
    throw error;
  } finally {
    setBusy(login.id, false);
  }
}

/**
 * After login, in the same browser: if the user opted in, runs the setup check
 * (approving this server's URL for Muse), then sends the summary prompt. Any
 * failure marks the profile failed with the reason.
 */
async function finishSetup(account: Account, login: Login): Promise<void> {
  const tag = `[${login.identifier}]`;
  try {
    await withPage(login.connect_url, async page => {
      const callbackToken = beginPrompt(account.id);
      if (login.auto_approve) {
        await runWithConnectionTest(page, tag, callbackToken, account.id, login.use_dms === 1, login.expires);
      } else {
        await submitPrompt(page, buildMusePrompt(callbackToken, { useDms: login.use_dms === 1 }));
        console.log(tag, "Summary prompt sent to Muse");
      }
    });
  } catch (error) {
    const full = error instanceof Error ? error.message : String(error);
    console.error(tag, "Muse setup failed:", full);
    // Browser errors append a long call log; the phone only needs the first line.
    const message = full.split("\n")[0].slice(0, 300);
    db().prepare("UPDATE accounts SET profile_status = 'error', profile_error = ?, callback_token = NULL WHERE id = ?")
      .run(`Setting up Muse failed: ${message}`, account.id);
  } finally {
    // Releasing the session is what saves the cookies to the context.
    await release(login.session_id).catch(error => console.error(tag, "Browserbase release failed:", error));
  }
}

/**
 * Sends the prompt with its connection test first, and approves Muse's card for
 * this server if one appears. Succeeds when the test POST arrives (Muse then
 * carries on with the Instagram job by itself); if it never does, throws with
 * what was seen, e.g. Muse declining.
 */
async function runWithConnectionTest(
  page: import("playwright-core").Page,
  tag: string,
  callbackToken: string,
  accountId: number,
  useDms: boolean,
  sessionEnds: number,
): Promise<void> {
  const host = new URL(config.publicUrl).hostname;
  const check = newToken();
  db().prepare("INSERT INTO setup_checks (token) VALUES (?)").run(check);
  const arrived = () => !!(db().prepare("SELECT received_at FROM setup_checks WHERE token = ?").get(check) as { received_at: number | null }).received_at;
  await submitPrompt(page, buildMusePrompt(callbackToken, { checkToken: check, useDms }));
  console.log(tag, `Prompt sent; waiting for Muse's connection test to reach ${host}`);
  const clicked = await approveSite(page, host, arrived, SETUP_CHECK_TIMEOUT_MS);
  if (clicked) console.log(tag, `Approved ${host} for Muse ("Always allow this site")`);
  const deadline = Date.now() + SETUP_CHECK_TIMEOUT_MS;
  while (!arrived() && Date.now() < deadline) await page.waitForTimeout(1000);
  if (!arrived()) {
    throw new MuseError(clicked
      ? `Approved ${host} for Muse, but Muse's test request never reached the server.`
      : `Muse didn't run the connection test (no request to ${host} and no approval card within ${SETUP_CHECK_TIMEOUT_MS / 60_000} minutes). Open the Muse app to see what it said.`);
  }
  console.log(tag, clicked ? "Connection test passed; Muse is reading Instagram" : `Connection test passed (${host} was already allowed); Muse is reading Instagram`);

  if (useDms) {
    // Muse may ask to turn on Instagram messages while it works. The person agreed
    // to that at sign-up, so accept it ("Always allow") while the browser session
    // lasts, or until Muse reports back.
    const profileDone = () =>
      (db().prepare("SELECT callback_token FROM accounts WHERE id = ?").get(accountId) as { callback_token: string | null }).callback_token === null;
    const watchFor = Math.max(0, sessionEnds - Date.now() - 20_000);
    const approved = await approveInstagram(page, profileDone, watchFor);
    console.log(tag, approved
      ? "Approved Instagram messages for Muse (\"Always allow\")"
      : profileDone() ? "Muse finished without asking about Instagram messages" : "No Instagram messages card appeared while the session lasted");
  }
}

/** Marks a prompt as sent and returns the single-use token Muse must call back with. */
function beginPrompt(accountId: number): string {
  const token = newToken();
  db().prepare("UPDATE accounts SET callback_token = ?, prompted_at = ?, profile_status = CASE WHEN username IS NULL THEN 'pending' ELSE profile_status END, profile_error = NULL WHERE id = ?")
    .run(token, Date.now(), accountId);
  return token;
}

/** Re-sends the summary prompt using the saved login. Used by the daily refresh. */
export async function sendSummaryPrompt(account: Account): Promise<void> {
  if (!account.browserbase_context_id) throw new MuseError("This account has no saved Muse login. Log in again from the app.");
  const session = await createSession(account.browserbase_context_id);
  try {
    const step = await withPage(session.connectUrl, async page => {
      await page.goto("https://muse.ai/", { waitUntil: "domcontentloaded" });
      return nextStep(page);
    });
    if (step !== "ready") throw new MuseError("Muse is no longer logged in (it asked for a code again). Log in again from the app.");
    const callbackToken = beginPrompt(account.id);
    await withPage(session.connectUrl, page => submitPrompt(page, buildMusePrompt(callbackToken, { useDms: account.use_dms === 1 })));
  } finally {
    await release(session.id).catch(() => {});
  }
}

/**
 * Muse's result: writes the taste_profile row to SpacetimeDB (replacing any
 * older one for this username), then marks the account ready. With
 * [summary] null (mock logins), the row must already exist.
 */
export async function completeProfile(account: Account, username: string, name: string, summary: string | null): Promise<void> {
  const taken = db().prepare("SELECT id FROM accounts WHERE username = ? AND id != ?").get(username, account.id);
  if (taken) throw new MuseError(`Username "${username}" already belongs to another account.`);
  if (summary !== null) await saveTasteProfile(name, username, summary);
  const profile = await tasteProfileByUsername(username);
  if (!profile) {
    db().prepare("UPDATE accounts SET profile_status = 'error', profile_error = ?, callback_token = NULL WHERE id = ?")
      .run(`No taste_profile row for "${username}" in SpacetimeDB.`, account.id);
    throw new MuseError(`No taste_profile row for "${username}" in SpacetimeDB.`);
  }
  db().prepare("UPDATE accounts SET username = ?, name = ?, summary = ?, profile_status = 'ready', profile_error = NULL, refresh_error = NULL, summarized_at = ?, callback_token = NULL WHERE id = ?")
    .run(username, name || profile.name, profile.summary, Date.now(), account.id);
  await registerForTexts({ ...account, name: name || profile.name });
}

/**
 * Puts the user's number on Photon's Users list so match texts can reach them.
 * Only for people who agreed to texts and when Photon is the notifier. A
 * failure doesn't block the profile; it's stored and shown in developer mode,
 * and the match text would fail with Photon's reason.
 */
export async function registerForTexts(account: Pick<Account, "id" | "phone_number" | "consent" | "name">): Promise<void> {
  if (!account.consent || config.notifier !== "photon") return;
  try {
    const { line } = await registerRecipient(account.phone_number, account.name);
    db().prepare("UPDATE accounts SET photon_error = NULL, photon_line = ? WHERE id = ?").run(line, account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Photon registration failed for account ${account.id}: ${message}`);
    db().prepare("UPDATE accounts SET photon_error = ? WHERE id = ?").run(message, account.id);
  }
}

/** Sends the confirmation text in the background and records how it went. */
export function confirmTexts(account: Pick<Account, "id" | "phone_number" | "username">): void {
  void (async () => {
    const error = await sendTextsConfirmation(account.phone_number);
    if (error) {
      console.error(`Confirmation text to ${account.username ?? account.id} failed: ${error}`);
      db().prepare("UPDATE accounts SET photon_error = ? WHERE id = ?").run(`Confirmation text failed: ${error}`, account.id);
    } else {
      console.log(`Confirmation text sent to ${account.username ?? account.id}`);
      db().prepare("UPDATE accounts SET texts_confirmed_at = ?, photon_error = NULL WHERE id = ?").run(Date.now(), account.id);
    }
  })();
}

/** Marks profiles failed when Muse hasn't called back in time. Called from GET /api/app/me. */
export function failIfTimedOut(account: Account): Account {
  if (account.profile_status === "pending" && account.prompted_at && Date.now() - account.prompted_at > config.museCallbackTimeoutMs) {
    const minutes = Math.round(config.museCallbackTimeoutMs / 60_000);
    db().prepare("UPDATE accounts SET profile_status = 'error', profile_error = ?, callback_token = NULL WHERE id = ?")
      .run(`Muse did not report back within ${minutes} minutes. Check the Muse app for errors, then log in again.`, account.id);
    return { ...account, profile_status: "error", profile_error: `Muse did not report back within ${minutes} minutes.` };
  }
  return account;
}

/** Testing without Muse: the taste_profile row must already exist (created with the spacetime CLI). */
export async function mockLogin(input: LoginInput, username: string): Promise<{ device_token: string }> {
  if (!config.mockMuse) throw new MuseError("MOCK_MUSE is off.");
  const { account, deviceToken } = upsertAccount({ ...input, browserbase_context_id: null });
  await completeProfile(account, username, "", null);
  return { device_token: deviceToken };
}

// Keep the raw client available for scripts.
export { browserbase };
