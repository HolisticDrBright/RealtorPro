import { chromium, devices } from "playwright";
import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
// Only paid generation is simulated. Editing, packet creation, PDF rendering,
// downloads and connected-vault writes use real routes in the guarded fixture.
const base = "http://127.0.0.1:3100";
const workspace = path.resolve("../RealtorPro-browser-workspace"), vault = path.resolve("../realtorpro-browser-vault");
const browser = await chromium.launch({ headless: true, channel: process.platform === "win32" ? "msedge" : undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
page.setDefaultTimeout(20000);
const created = [], draftIds = [], errors = []; let sqlite, packetId;
const read = async (url) => { const r = await context.request.get(base + url); assert.ok(r.ok(), await r.text()); return r.json(); };
const post = async (url, data) => { const r = await context.request.post(base + url, { headers: { Origin: base }, data }); assert.ok(r.ok(), await r.text()); return r.json(); };
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/buyers?tab=matches");
  const status = await read("/api/integrations/status");
  assert.ok(status.obsidian.dir?.endsWith("realtorpro-browser-vault")); assert.equal(status.claude.configured, false);
  sqlite = new Database(path.join(workspace, "command-center.db")); sqlite.pragma("foreign_keys = ON");
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM match_drafts").get().n, 0);
  const c = (await post("/api/contacts", { firstName: "Alex", lastName: "PacketTest", email: "alex-packet@example.com" })).item; created.push(["contacts", c.id]);
  const buyer = (await post("/api/buyers", { contactId: c.id, priceMax: 700000, minBeds: 3, targetAreas: ["Test City"] })).item; created.push(["buyers", buyer.id]);
  const records = [];
  for (let i = 0; i < 2; i++) {
    const p = (await post("/api/properties", { address: (10 + i) + " Packet Test Way", city: "Test City", beds: 3, baths: 2, sqft: 1800 })).item; created.push(["properties", p.id]);
    const l = (await post("/api/listings", { propertyId: p.id, listPrice: 650000, status: "active" })).item; created.push(["listings", l.id]); records.push({ p, l });
  }
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: "10 Packet Test Way" }).filter({ hasText: "Alex PacketTest" });
  await row.getByRole("link", { name: "Match", exact: true }).click();
  const generate = page.getByRole("button", { name: "Generate email + text", exact: true });
  await generate.waitFor(); assert.equal(await generate.isDisabled(), true);
  await page.getByLabel("Allow the buyer’s first name", { exact: false }).check();
  const fail = page.waitForResponse((r) => r.url() === base + "/api/match-drafts" && r.request().method() === "POST");
  await generate.click(); assert.equal((await fail).status(), 422); await page.getByText("Connect Claude in Integrations first.", { exact: true }).waitFor();
  await page.route("**/api/match-drafts", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const input = route.request().postDataJSON(), record = records.find((r) => r.l.id === input.candidateId); assert.ok(record); assert.equal(input.consent, true);
    const m = (await read("/api/match")).matches.find((m) => m.buyerId === buyer.id && m.candidateId === record.l.id);
    const snapshot = { buyerName: "Alex", criteria: { priceMin: null, priceMax: 700000, targetAreas: ["Test City"], minBeds: 3, minBaths: null, minSqft: null, propertyType: null, mustHaves: [], dealBreakers: [] }, property: { address: record.p.address, area: "Test City", price: 650000, beds: 3, baths: 2, sqft: 1800, propertyType: record.p.propertyType, yearBuilt: null, lotSqft: null, view: null, status: "active", kind: "listing" }, reasons: m.reasons, concerns: m.concerns, signature: { name: "Agent", brokerage: "" } };
    const body = "Hi Alex,\n\n" + record.p.address + " has three bedrooms, two bathrooms and 1,800 sq ft in Test City. At $650,000 it fits the saved price criteria.\n\n" + (record === records[1] ? "We should confirm current availability and arrange a showing only after you choose a time. ".repeat(45) + "\n\n" : "") + "Would you like to discuss a showing?\n\nAgent";
    sqlite.prepare("INSERT INTO match_drafts (id,buyer_id,candidate_id,kind,context,options,status,model,subject,email,sms,recipient) VALUES (?,?,?,?,?,?,'complete','simulated-browser-test',?,?,?,?)")
      .run(input.id, buyer.id, record.l.id, "listing", JSON.stringify(snapshot), JSON.stringify(input.options), "A potential fit: " + record.p.address, body, "Alex, " + record.p.address + " has 3 bedrooms in Test City. Want to discuss a showing?", c.email);
    draftIds.push(input.id);
    await route.fulfill({ json: await read("/api/match-drafts?id=" + input.id) });
  });
  await generate.click(); await page.getByLabel("Email message", { exact: true }).waitFor();
  await page.getByLabel("Email message", { exact: true }).fill("Hi Alex,\n\nReviewed version for 10 Packet Test Way: three bedrooms in your target area at $650,000. Shall we discuss a showing?\n\nAgent");
  await page.getByRole("button", { name: "Save edits for PDF", exact: true }).click();
  await page.getByText("Draft edits saved for your PDF packet", { exact: true }).waitFor();
  await page.reload(); await page.getByLabel("Email message", { exact: true }).waitFor();
  assert.ok((await page.getByLabel("Email message", { exact: true }).inputValue()).includes("Reviewed version"));
  await page.getByRole("link", { name: "Match another buyer", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "11 Packet Test Way" }).filter({ hasText: "Alex PacketTest" }).getByRole("link", { name: "Match", exact: true }).click();
  await page.getByLabel("Allow the buyer’s first name", { exact: false }).check(); await page.getByRole("button", { name: "Generate email + text", exact: true }).click();
  await page.getByLabel("Email message", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Review PDF packet →", exact: true }).click();
  await page.getByText("Selected for next packet: 2", { exact: true }).waitFor();
  const save = page.getByRole("button", { name: "Save PDF to Obsidian vault", exact: true }); assert.equal(await save.isDisabled(), true);
  await page.getByLabel("I reviewed the selected messages", { exact: false }).check();
  const packetResponse = page.waitForResponse((r) => r.url() === base + "/api/match-packets" && r.request().method() === "POST");
  await save.click(); const response = await packetResponse; assert.equal(response.status(), 200); packetId = (await response.json()).item.id;
  await page.getByText("PDF saved to your connected vault", { exact: true }).waitFor();
  assert.ok(fs.existsSync(path.join(vault, "Command Center", "Buyer Matches", packetId + ".pdf")));
  const pdf = await context.request.get(base + "/api/match-packets/" + packetId); assert.equal(pdf.headers()["content-type"], "application/pdf");
  const bytes = await pdf.body(); assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  fs.writeFileSync(path.resolve("../../outputs/realtorpro-buyer-match-qa.pdf"), bytes);
  assert.equal((await read("/api/buyers/" + buyer.id)).item.propertiesSent, 0);
  await page.reload(); await page.getByText("Selected for next packet: 0", { exact: true }).waitFor();
  await page.screenshot({ path: path.resolve("../../outputs/realtorpro-match-packet-desktop.png"), fullPage: true });
  const mobileContext = await browser.newContext({ ...devices["iPhone 13"] }), mobile = await mobileContext.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message)); await mobile.goto(base + "/buyer-match-packet"); await mobile.getByText("Selected for next packet: 0", { exact: true }).waitFor();
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.screenshot({ path: path.resolve("../../outputs/realtorpro-match-packet-mobile.png"), fullPage: true }); await mobileContext.close();
  assert.deepEqual(errors, []); console.log("PASS Match navigation, consent, missing-key error, simulated generation, real edits/reload, two-match packet, PDF download, real guarded vault export, queue reset, unchanged sent count, desktop/mobile.");
} finally {
  if (packetId) {
    for (const file of [path.join(workspace, "exports/buyer-matches", packetId + ".pdf"), path.join(vault, "Command Center/Buyer Matches", packetId + ".pdf")]) if (fs.existsSync(file)) fs.unlinkSync(file);
    sqlite?.prepare("DELETE FROM match_packets WHERE id = ?").run(packetId);
  }
  for (const id of draftIds) sqlite?.prepare("DELETE FROM match_drafts WHERE id = ?").run(id);
  for (const [entity, id] of created.reverse()) await context.request.delete(base + "/api/" + entity + "/" + id, { headers: { Origin: base } });
  sqlite?.close(); await browser.close();
}
