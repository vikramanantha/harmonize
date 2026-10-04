// Sends one test iMessage through Photon, the first thing to verify before the
// matcher can text anyone:
//   node --env-file=.env scripts/photon-test.mjs +15551234567
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

const to = process.argv[2];
if (!/^\+[1-9]\d{6,14}$/.test(to ?? "")) {
  console.error("Usage: node --env-file=.env scripts/photon-test.mjs +15551234567");
  process.exit(1);
}
for (const name of ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET"]) {
  if (!process.env[name]) { console.error(`${name} is not set in .env`); process.exit(1); }
}

const app = await Spectrum({
  projectId: process.env.SPECTRUM_PROJECT_ID,
  projectSecret: process.env.SPECTRUM_PROJECT_SECRET,
  providers: [imessage.config()],
});
try {
  const im = imessage(app);
  const user = await im.user(to);
  const dm = await im.space.create(user);
  const message = await dm.send("Harmonize test: Photon is connected.");
  console.log("sent", message?.id ?? "(no message id returned)");
} finally {
  await app.stop();
}
