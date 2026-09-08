import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = "http://127.0.0.1:3100";
const secretFile = path.resolve("../RealtorPro-browser-workspace/google-calendar.secret.json");
if (fs.existsSync(secretFile)) throw new Error("Refusing to overwrite an existing Google connection. Use an empty isolated fixture.");
const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(20000);
const errors = []; let savedFixture = false;
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/integrations");
  const status = await (await context.request.get(base + "/api/integrations/status")).json();
  assert.ok(status.obsidian.dir?.endsWith("realtorpro-browser-vault")); assert.equal(status.claude.configured, false);
  const initial = await (await context.request.get(base + "/api/google")).json(); assert.equal(initial.configured, false);
  const connect = page.getByRole("button", { name: "Connect Google Calendar", exact: true });
  await connect.waitFor(); assert.equal(await connect.isDisabled(), true);
  await page.getByText(base + "/google/callback", { exact: true }).waitFor();
  await page.getByLabel("Google OAuth client ID", { exact: true }).fill("123-test.apps.googleusercontent.com");
  await page.getByLabel("Google OAuth client secret", { exact: true }).fill("synthetic-browser-client-secret");
  const saved = page.waitForResponse((r) => r.url() === base + "/api/google" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save Google setup", exact: true }).click();
  assert.equal((await saved).status(), 200); savedFixture = true;
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Connect Google Calendar" && !b.disabled));
  assert.equal(fs.readFileSync(secretFile, "utf8").includes("synthetic-browser-client-secret"), false, "OAuth secret encrypted at rest");
  assert.equal(await page.getByLabel("Google OAuth client secret", { exact: true }).inputValue(), "");
  await page.reload(); await connect.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Connect Google Calendar" && !b.disabled));
  assert.equal(await connect.isDisabled(), false, "Saved setup survives reload");
  // Check the real OAuth-start response without sending the synthetic client
  // credentials to Google. Live OAuth completion is covered with fetch fixtures
  // in integration tests and must still be tested with the user's real account.
  const started = await context.request.post(base + "/api/google", { headers: { Origin: base }, data: { action: "connect" } }); assert.equal(started.status(), 200);
  const auth = new URL((await started.json()).url); assert.equal(auth.origin, "https://accounts.google.com"); assert.equal(auth.searchParams.get("redirect_uri"), base + "/google/callback"); assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  const cookie = (await context.cookies(base + "/google/callback")).find((c) => c.name === "google-oauth-state"); assert.equal(cookie?.httpOnly, true); assert.equal(cookie?.sameSite, "Lax");
  const response = await context.request.get(base + "/google/callback?state=invalid&code=invalid"); assert.equal(response.status(), 400);
  await page.getByText("One-time Google setup", { exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.resolve("../../outputs/realtorpro-google-connect.png"), fullPage: true });
  await page.goto(base + "/calendar"); await page.getByText("Connect / manage Google Calendar →", { exact: true }).waitFor();
  await page.getByText("Connect / manage Google Calendar →", { exact: true }).click(); await connect.waitFor();
  const phoneContext = await browser.newContext({ ...devices["iPhone 13"] }); const phone = await phoneContext.newPage(); phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base + "/integrations"); await phone.getByRole("button", { name: "Connect Google Calendar", exact: true }).waitFor();
  await phone.getByText("One-time Google setup", { exact: true }).click();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No mobile horizontal overflow");
  await phone.screenshot({ path: path.resolve("../../outputs/realtorpro-google-connect-mobile.png"), fullPage: true });
  await phoneContext.close(); assert.deepEqual(errors, []);
  console.log("PASS Google setup UI, encrypted synthetic credentials, reload, Connect button, real OAuth start/PKCE/cookie, invalid callback rejection, calendar navigation, desktop/mobile. No live Google sign-in or calendar request performed.");
} finally {
  // Only the credential file this test created in the explicit test workspace.
  if (savedFixture && fs.existsSync(secretFile)) {
    const envelope = JSON.parse(fs.readFileSync(secretFile, "utf8"));
    if (process.platform === "darwin" && /^[a-f0-9-]{36}$/.test(envelope.account || "")) execFileSync(path.resolve("scripts/macos/.build/realtorpro-keychain"), ["delete", envelope.account], { stdio: "pipe" });
    fs.unlinkSync(secretFile);
  }
  await browser.close();
}
