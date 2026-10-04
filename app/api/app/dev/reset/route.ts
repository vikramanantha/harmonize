// Developer mode "Reset demo": clears who has been texted and recent sightings,
// for every user (see resetDemo). Any signed-in phone can call it, and only when
// DEMO_RESET is on (the default), so turn it off outside of demos.
import { handler, HttpError, json, requireAccount } from "@/lib/auth";
import { config } from "@/lib/config";
import { resetDemo } from "@/lib/matching";

export const runtime = "nodejs";

export const POST = handler(async request => {
  const account = (await requireAccount(request));
  if (!config.demoReset) throw new HttpError(403, "Demo reset is turned off on this server (DEMO_RESET=false).");
  const cleared = (await resetDemo());
  console.log(`Demo reset by ${account.username ?? account.id}: ${cleared.notifications} texts, ${cleared.sightings} sightings cleared`);
  return json({ ok: true, ...cleared });
});
