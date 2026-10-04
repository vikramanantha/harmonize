"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";

export function MuseLogin() {
  const [step, setStep] = useState("start");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = step === "start"
      ? { action: "start", identifier: data.get("identifier"), prompt: data.get("prompt") }
      : { action: "verify", credential: data.get("credential") };
    // Clear the credential immediately; it is never put in local storage.
    if (step !== "start") form.reset();
    setBusy(true); setError(false); setMessage("The browser is working…");
    try {
      const response = await fetch("/api/muse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      setStep(result.step); setMessage(result.message);
    } catch (error) {
      setError(true); setMessage(error instanceof Error ? error.message : "Unable to connect.");
    } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try {
      const response = await fetch("/api/muse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      if (!response.ok) throw new Error("Unable to close session. Try again.");
      setStep("start"); setMessage(""); setError(false);
    } catch (error) { setError(true); setMessage(error instanceof Error ? error.message : "Unable to close session."); }
    finally { setBusy(false); }
  }
  return <section className="connect-panel muse-panel">
    <span className="eyebrow">MUSE / BROWSERBASE</span>
    <h2>Give Muse a task.</h2>
    <p>Sign in through a browser in the background, then send your prompt.</p>
    {step !== "done" && <form onSubmit={run} className="muse-form">
      {step === "start" ? <>
        <label htmlFor="muse-identifier">Mobile number or email</label>
        <input id="muse-identifier" name="identifier" autoComplete="username" required maxLength={254} disabled={busy} placeholder="you@example.com" />
        <label htmlFor="muse-prompt">Prompt for Muse</label>
        <textarea id="muse-prompt" name="prompt" required maxLength={8000} rows={5} disabled={busy} placeholder="What would you like Muse to do?" />
      </> : <>
        <label htmlFor="muse-credential">{step === "password" ? "Password" : "Verification code"}</label>
        <input key={step} id="muse-credential" name="credential" type={step === "password" ? "password" : "text"} autoComplete={step === "password" ? "current-password" : "one-time-code"} required maxLength={512} disabled={busy} autoFocus />
      </>}
      <button className="button full" type="submit" disabled={busy}>{busy ? "Working…" : step === "start" ? "Continue with Muse" : "Verify and send prompt"}</button>
    </form>}
    <p className="connection-status" role={error ? "alert" : "status"} aria-live="polite">{message}</p>
    {(step !== "start" || error) && <button type="button" className="button secondary full" onClick={cancel} disabled={busy}>{step === "done" ? "Send another prompt" : "Cancel and start again"}</button>}
    <p className="privacy"><LockKeyhole size={16} />Credentials are sent to Muse through Browserbase. They are not saved by this app. Browser recording is disabled; sessions expire after 10 minutes.</p>
  </section>;
}
