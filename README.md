# VibeCheck

A static, editorial social-discovery frontend built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, and Lucide React.

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

All demo content is in `lib/data.ts`. Reel covers are original typographic compositions, not playable videos. No authentication, account access, backend, or compatibility calculation is implemented.

## Validate

```sh
npm run lint
npm run typecheck
npm run build
```

## Deploy to Vercel

Import this repository into Vercel, use the Next.js framework preset, and deploy. No environment variables or external services are required. For a local production preview, run `npm run build` followed by `npm start`.

Shared UI is in `components/`, route content is in `app/`, and the design tokens and responsive layouts are in `app/globals.css`. Interactive navigation, the connection notice, and motion wrappers are small client components; page content renders on the server. Reduced-motion preferences are respected.
