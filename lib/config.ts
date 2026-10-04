// Server configuration. Every value comes from .env; see .env.example.
// Required values throw when first used (not at import), so `next build` works
// without a .env but a misconfigured server fails loudly on the first request.

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`${name} is not set in .env`);
}

function num(name: string, fallback: number): number {
  const value = Number(env(name, String(fallback)));
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = env(name, String(fallback)).toLowerCase();
  if (value !== "true" && value !== "false") throw new Error(`${name} must be true or false`);
  return value === "true";
}

export const config = {
  /** Where Muse (running in Meta's cloud) reaches this server, e.g. an ngrok URL. */
  get publicUrl() { return env("SERVER_PUBLIC_URL").replace(/\/$/, ""); },
  get dbPath() { return env("DB_PATH", "./data/harmony.sqlite"); },

  spacetime: {
    get host() { return env("SPACETIME_HOST", "https://maincloud.spacetimedb.com"); },
    get database() { return env("SPACETIME_DB", "harmony-1o7k0"); },
  },

  /** The Python similarity service in semantic/service.py. */
  get semanticUrl() { return env("SEMANTIC_URL", "http://127.0.0.1:8008").replace(/\/$/, ""); },

  /** Cosine similarity needed for a match. Hyperparameter; tune it. */
  get matchThreshold() { return num("MATCH_THRESHOLD", 0.8); },
  /** false: a phone stops reporting encounters after its first notified match. */
  get loop() { return bool("LOOP", false); },
  /** Both phones must report seeing each other within this window to count as "nearby". */
  get proximityWindowMs() { return num("PROXIMITY_WINDOW_MS", 10_000); },
  /** A pair is texted at most once per encounter; a new encounter starts after this. */
  get encounterCooldownMs() { return num("ENCOUNTER_COOLDOWN_MS", 60 * 60_000); },

  /** How long to wait for Muse to call back after a prompt before marking the profile failed. */
  get museCallbackTimeoutMs() { return num("MUSE_CALLBACK_TIMEOUT_MS", 20 * 60_000); },
  /** How often each account's Instagram summary is refreshed. */
  get summaryRefreshMs() { return num("SUMMARY_REFRESH_MS", 24 * 60 * 60_000); },

  /** Lets any signed-in phone run "Reset demo" (developer mode). Turn off outside of demos. */
  get demoReset() { return bool("DEMO_RESET", true); },

  /** "photon" sends iMessages through Photon; "log" only prints them (local testing). */
  get notifier() {
    const value = env("NOTIFIER", "photon");
    if (value !== "photon" && value !== "log") throw new Error("NOTIFIER must be photon or log");
    return value;
  },

  /**
   * Testing without Muse/Browserbase: login succeeds immediately for a username
   * whose taste_profile row you created by hand with the spacetime CLI.
   */
  get mockMuse() { return bool("MOCK_MUSE", false); },
};
