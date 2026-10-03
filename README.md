# VibeCheck

An editorial social-discovery frontend with a Muse browser integration, built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, and Lucide React.

## Develop

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Routes

- `/` — landing page and product concept
- `/connect` — onboarding prototype; Instagram button reveals a coming-soon message
- `/vibe` — fictional digital taste profile
- `/match` — illustrative compatibility preview with a fixed 84% score

All demo content is in `lib/data.ts`. Reel covers are original typographic compositions, not playable videos. The social-discovery routes use fictional data; `/muse` connects to a real Muse account through Browserbase.

## Validate

```sh
npm run lint
npm run typecheck
npm run build
```

## Deploy to Vercel

The Muse integration currently requires a single long-running Node server and a Browserbase API key. For a local production preview, run `npm run build` followed by `npm start`. Shared storage for pending browser sessions is required before deploying across serverless instances.

Shared UI is in `components/`, route content is in `app/`, and the design tokens and responsive layouts are in `app/globals.css`. Interactive navigation, the connection notice, and motion wrappers are small client components; page content renders on the server. Reduced-motion preferences are respected.
## Muse browser integration

Visit `/muse` (or **Connect Muse** in the navigation). Enter your Muse mobile
number or email and a prompt, then enter the verification code or password
requested by the remote browser. Browserbase runs the browser on the server.

Set `BROWSERBASE_API_KEY` in `.env`; see `.env.example` for optional settings.
Run `npm install`, then `npm run dev`. No local Chromium installation is needed.
The inspected Muse landing page uses **Mobile number or email → Continue**.
Subsequent authentication and authenticated prompt submission require a real
account to validate. Unsupported SSO, CAPTCHA, or onboarding steps return an
error. Chat selectors can be overridden with `MUSE_PROMPT_SELECTOR` and
`MUSE_SEND_SELECTOR` once inspected in an authenticated account.

This prototype keeps pending sessions in server memory and requires a single
long-running Node process; restarting it loses pending logins. Browserbase
sessions expire after ten minutes. Completed and cancelled sessions are released.
Credentials are not persisted or logged, and browser recordings and session logs
are disabled. Add application authentication and shared session storage before
deploying this endpoint publicly.

To inspect the public login page again:
`node --env-file=.env scripts/inspect-muse.mjs`.

To check the page and API validation against a running local server:
`TEST_BASE_URL=http://localhost:3000 node scripts/check-muse.mjs`
(in PowerShell, set `$env:TEST_BASE_URL` first). These checks create no remote sessions.
