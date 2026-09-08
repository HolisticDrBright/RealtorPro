import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

const base = process.env.TEST_URL || "http://127.0.0.1:3100";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3100$/.test(base)) throw new Error("Use the isolated test server on port 3100.");
const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [], created = [];
page.on("pageerror", (e) => errors.push(e.message));
const read = (url) => page.evaluate(async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }, url);
const response = (url, method) => page.waitForResponse((r) => r.url().endsWith(url) && r.request().method() === method);
try {
  await page.goto(base + "/off-market");
  await page.getByRole("heading", { name: "Off-Market", exact: true }).waitFor();
  const status = await read("/api/integrations/status");
  assert.ok(status.obsidian.dir?.endsWith("realtorpro-browser-vault"), "Refusing to use a personal vault");
  assert.equal(status.claude.configured, false);
  assert.equal((await read("/api/opportunities")).count, 0, "Use an empty opportunity test fixture");
  await page.getByRole("button", { name: "+ Off-market lead", exact: true }).first().click();
  assert.equal(await page.getByLabel("Type", { exact: true }).inputValue(), "off_market");
  await page.getByLabel("Address").fill("101 Off Market Test Lane");
  await page.getByLabel("Area", { exact: true }).fill("Test Market");
  await page.getByLabel("Source / agent", { exact: true }).fill("Test referral");
  await page.getByLabel("Expected price", { exact: true }).fill("750000");
  let saved = response("/api/opportunities", "POST");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const createResponse = await saved;
  assert.equal(createResponse.status(), 201);
  const lead = (await createResponse.json()).item; created.push(["opportunities", lead.id]);
  await page.getByText(lead.address, { exact: true }).waitFor();
  await page.reload();
  await page.getByText(lead.address, { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Confirm owner permission before sharing.");
  saved = response(`/api/opportunities/${lead.id}`, "PATCH");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.getByRole("link", { name: "All opportunities", exact: true }).click();
  await page.getByText("Confirm owner permission before sharing.", { exact: true }).waitFor();
  assert.equal((await read("/api/opportunities")).count, 1, "The two tabs share the same record");
  await page.getByRole("link", { name: "Off-Market tab", exact: true }).click();
  await page.getByText(lead.address, { exact: true }).waitFor();
  saved = response(`/api/opportunities/${lead.id}`, "PATCH");
  await page.getByLabel(`Status for ${lead.address}`, { exact: true }).selectOption("dead");
  assert.equal((await saved).status(), 200);
  await page.getByText("No off-market leads to show", { exact: true }).waitFor();
  await page.getByLabel("Lead status filter", { exact: true }).selectOption("dead");
  await page.getByText(lead.address, { exact: true }).waitFor();
  saved = response(`/api/opportunities/${lead.id}`, "PATCH");
  await page.getByLabel(`Status for ${lead.address}`, { exact: true }).selectOption("watching");
  assert.equal((await saved).status(), 200);
  await page.getByLabel("Lead status filter", { exact: true }).selectOption("active");
  await page.getByText(lead.address, { exact: true }).waitFor();
  await page.getByRole("button", { name: "+ Task", exact: true }).click();
  assert.equal(await page.getByLabel("Task", { exact: false }).first().inputValue(), `Follow up on ${lead.address}`);
  saved = response("/api/tasks", "POST");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const taskResponse = await saved; assert.equal(taskResponse.status(), 201);
  created.push(["tasks", (await taskResponse.json()).item.id]);
  for (const kind of ["pocket_listing", "coming_soon"]) {
    const item = await page.evaluate(async (kind) => {
      const r = await fetch("/api/opportunities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: `202 ${kind} Test Lane`, kind }) });
      if (!r.ok) throw new Error(`Test fixture failed: ${r.status}`); return (await r.json()).item;
    }, kind);
    created.push(["opportunities", item.id]);
  }
  await page.reload();
  await page.getByText("202 pocket_listing Test Lane", { exact: true }).waitFor();
  assert.equal(await page.getByText("202 coming_soon Test Lane", { exact: true }).count(), 0);
  await page.getByLabel("Search property leads", { exact: true }).fill("referral");
  assert.equal(await page.getByText("202 pocket_listing Test Lane", { exact: true }).count(), 0);
  await page.getByText(lead.address, { exact: true }).waitFor();
  const hit = (await read("/api/search?q=101%20Off%20Market")).hits.find((h) => h.id === lead.id);
  assert.equal(hit?.href, `/off-market?focus=${lead.id}`);
  await page.goto(base + hit.href);
  await page.getByText(lead.address, { exact: true }).waitFor();
  await page.getByRole("link", { name: "Clear focused lead", exact: true }).click();
  await page.getByText("202 pocket_listing Test Lane", { exact: true }).waitFor();
  await page.screenshot({ path: path.resolve("../../outputs/realtorpro-off-market-desktop.png"), fullPage: true, animations: "disabled" });
  const phoneContext = await browser.newContext({ ...devices["iPhone 13"] });
  const phone = await phoneContext.newPage(); phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base + "/off-market");
  await phone.getByText(lead.address, { exact: true }).waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No mobile horizontal overflow");
  await phone.screenshot({ path: path.resolve("../../outputs/realtorpro-off-market-mobile.png"), fullPage: true, animations: "disabled" });
  await phoneContext.close();
  assert.deepEqual(errors, []);
  console.log("PASS off-market create/edit/reload; shared Opportunities records; archive/recover; task; private-kind filtering; search/focus; desktop/mobile layout; no browser exceptions");
} finally {
  for (const [entity, id] of created.reverse()) {
    await page.evaluate(async ({ entity, id }) => { const r = await fetch(`/api/${entity}/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Test record cleanup failed"); }, { entity, id });
  }
  await browser.close();
}
