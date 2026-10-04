import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL || "http://localhost:3011";
const page = await fetch(`${base}/muse`);
assert.equal(page.status, 200);
assert.ok((await page.text()).includes("Mobile number or email"));
for (const [name, origin, body, status] of [
  ["cross-origin", "https://example.com", { action: "start" }, 403],
  ["missing fields", base, { action: "start" }, 400],
  ["expired session", base, { action: "verify", credential: "123456" }, 410],
]) {
  const response = await fetch(`${base}/api/muse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, status, name);
  console.log(`${name}: passed`);
}
console.log("Muse page and API validation passed. No remote sessions created.");
