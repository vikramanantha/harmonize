// Adds a phone number to the Photon project's Users list (needed on Free/Pro
// plans before Photon will text it). The server does this automatically when a
// profile becomes ready; this is for one-off numbers and testing:
//   node --env-file=.env scripts/photon-register.mjs +15551234567 ["First Last"]
const [phone, name = ""] = process.argv.slice(2);
if (!/^\+[1-9]\d{6,14}$/.test(phone ?? "")) {
  console.error('Usage: node --env-file=.env scripts/photon-register.mjs +15551234567 ["First Last"]');
  process.exit(1);
}
const { SPECTRUM_PROJECT_ID: id, SPECTRUM_PROJECT_SECRET: secret } = process.env;
if (!id || !secret) { console.error("SPECTRUM_PROJECT_ID / SPECTRUM_PROJECT_SECRET are not set in .env"); process.exit(1); }
const [firstName, ...rest] = name.trim().split(/\s+/).filter(Boolean);
const response = await fetch(`https://spectrum.photon.codes/projects/${id}/users/`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "shared", phoneNumber: phone, ...(firstName ? { firstName } : {}), ...(rest.length ? { lastName: rest.join(" ") } : {}) }),
});
const body = await response.json().catch(() => null);
if (!response.ok || !body?.succeed) { console.error(`Failed (${response.status}):`, JSON.stringify(body)); process.exit(1); }
console.log(`Registered ${body.data.phoneNumber} (user ${body.data.id}, type ${body.data.type})`);
