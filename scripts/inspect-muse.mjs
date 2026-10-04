import { chromium } from 'playwright-core';

const headers = { 'X-BB-API-Key': process.env.BROWSERBASE_API_KEY, 'Content-Type': 'application/json' };
const response = await fetch('https://api.browserbase.com/v1/sessions', { method: 'POST', headers, body: JSON.stringify({ timeout: 120, browserSettings: { recordSession: false, logSession: false } }) });
if (!response.ok) throw new Error(`Browserbase session creation failed (${response.status})`);
const session = await response.json();
let browser;
try {
  browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0] ?? await browser.contexts()[0].newPage();
  await page.goto('https://muse.ai', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 12000));
  console.log(await page.locator('input, button, a').evaluateAll(elements => elements.map(e => ({ tag: e.tagName, text: e.textContent?.trim(), type: e.getAttribute('type'), placeholder: e.getAttribute('placeholder'), href: e.getAttribute('href') }))));
} finally {
  await browser?.close();
  await fetch(`https://api.browserbase.com/v1/sessions/${session.id}`, { method: 'POST', headers, body: JSON.stringify({ status: 'REQUEST_RELEASE' }) });
}
