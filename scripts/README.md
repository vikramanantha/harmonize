# scripts

- `setup-neon.mjs` — create app tables and pgvector: `npm run db:setup`.
- `reset-demo.mjs` — clear notifications and sightings in Neon: `node --env-file=.env scripts/reset-demo.mjs`.

- `photon-test.mjs` — send one test iMessage through Photon: `node --env-file=.env scripts/photon-test.mjs +1555…`
- `check-muse.mjs`, `inspect-muse.mjs` — the web `/muse` page checks (web pages are slated for removal).
