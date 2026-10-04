// Restarts the demo for everyone from the Mac: forgets who has been texted and
// all recent sightings (the same as "Reset demo" in the app's developer mode).
// Match scores are kept. Run while the server is running or not:
//   node --env-file=.env scripts/reset-demo.mjs
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const sql = neon(process.env.DATABASE_URL);
const [texts, sightings] = await sql.transaction([
  sql.query("DELETE FROM notifications", [], { fullResults: true }),
  sql.query("DELETE FROM sightings", [], { fullResults: true }),
]);
console.log(`Demo reset: cleared ${texts.rowCount} texts and ${sightings.rowCount} sightings.`);
