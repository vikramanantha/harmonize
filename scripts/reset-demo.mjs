// Restarts the demo for everyone from the Mac: forgets who has been texted and
// all recent sightings (the same as "Reset demo" in the app's developer mode).
// Match scores are kept. Run while the server is running or not:
//   node --env-file=.env scripts/reset-demo.mjs
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.env.DB_PATH || "./data/harmony.sqlite");
const texts = db.prepare("DELETE FROM notifications").run().changes;
const sightings = db.prepare("DELETE FROM sightings").run().changes;
console.log(`Demo reset: cleared ${texts} texts and ${sightings} sightings.`);
