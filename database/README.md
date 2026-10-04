# Neon database organization

This workspace is linked to project `hidden-bonus-86672718`, branch `production`.
One Postgres database holds ordinary app data and pgvector embeddings in separate tables.

| Tables | Purpose |
| --- | --- |
| `accounts` | Account details, consent, token hashes and profile/texting state |
| `logins`, `setup_checks` | Pending Muse login and setup state |
| `taste_profile` | Instagram names, usernames and summaries |
| `sightings` | Bluetooth encounter reports |
| `scores` | Authoritative cached pair scores |
| `match_result` | Separate display copy of match results |
| `notifications` | Text delivery and retry history |
| `user_profiles` | Vector records: source summary and `embedding vector(384)` |

The active scorer keys vectors by the SHA-256 hash of the exact summary.
The standalone Python profile helpers can also use explicit user IDs.
Vectors are written when scoring; creating a taste profile alone does not generate a vector.
The existing model, normalization and Python dot-product scoring are unchanged.

`neon.ts` in the repository root configures Neon services; `lib/neon.ts` is the app's query client.
`neon deploy` applies service configuration. `npm run db:setup` creates the SQL tables from
`database/schema.sql`; it can be rerun without deleting records.

Neon CLI maintains `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in the gitignored `.env`.
The app and Python service use the pooled URL; schema setup prefers the unpooled URL.
