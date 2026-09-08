import { chromium, devices } from "playwright";
import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Browser speech and model output are simulated ONLY in this test script.
// The app contains no demo responses. History GET, review approval and CRM writes
// use the real running backend and a guarded, synthetic workspace on port 3100.
const base = process.env.TEST_URL || "http://127.0.0.1:3100";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3100$/.test(base)) throw new Error("Use the isolated test server on port 3100.");
const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addInitScript(() => {
  window.__jarvisSpeechStarts = 0;
  window.SpeechRecognition = class {
    start() { window.__jarvisSpeechStarts++; window.__jarvisRecognition = this; }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { cancel() {}, getVoices: () => [], speak() { window.__jarvisReadAloud = true; } } });
});
const page = await context.newPage(); page.setDefaultTimeout(20000);
const errors = [], created = [], turns = [], reviewIds = [];
let sqlite;
page.on("pageerror", (e) => errors.push(e.message));
const read = async (url) => { const response = await context.request.get(base + url); assert.ok(response.ok(), `${url}: ${response.status()}`); return response.json(); };
const post = async (url, data) => { const response = await context.request.post(base + url, { headers: { Origin: base }, data }); assert.ok(response.ok(), `${url}: ${response.status()}`); return response.json(); };
try {
  await page.goto(base + "/jarvis");
  await page.getByRole("heading", { name: "Ask Jarvis", exact: true }).waitFor();
  const status = await read("/api/integrations/status");
  assert.ok(status.obsidian.dir?.endsWith("realtorpro-browser-vault"), "Refusing a personal vault");
  assert.equal(status.claude.configured, false, "This test must not call a paid API");
  sqlite = new Database(path.resolve("../RealtorPro-browser-workspace/command-center.db"));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM jarvis_turns").get().count, 0, "Use an empty Jarvis fixture");
  assert.equal(await page.getByRole("button", { name: "Microphone", exact: true }).isDisabled(), true);
  await page.getByLabel("Your question", { exact: true }).fill("Which investors want a duplex?");
  assert.equal(await page.getByRole("button", { name: "Ask Jarvis", exact: true }).isDisabled(), true);
  await page.getByLabel("Allow Jarvis to send my questions", { exact: false }).check();
  const failed = page.waitForResponse((r) => r.url() === base + "/api/jarvis" && r.request().method() === "POST");
  await page.getByRole("button", { name: "Ask Jarvis", exact: true }).click();
  assert.equal((await failed).status(), 422);
  await page.getByText("Connect Claude on the Integrations page first.", { exact: true }).waitFor();
  assert.equal((await read("/api/jarvis")).items.length, 0);
  await page.getByLabel("Your question", { exact: true }).fill("");
  await page.getByLabel("Allow browser speech recognition", { exact: false }).check();
  await page.getByText("Voice & privacy", { exact: true }).click();
  await page.getByLabel("Send my recognized question automatically", { exact: false }).check();
  await page.getByLabel("Read Jarvis answers aloud", { exact: false }).check();

  const c = (await post("/api/contacts", { firstName: "JarvisBrowser", lastName: "Test", email: "jarvis-browser@example.com" })).item;
  created.push(["contacts", c.id]);
  const taskTitle = "Jarvis browser approval test " + randomUUID().slice(0, 8);
  const items = [{ entity: "tasks", fields: { title: taskTitle, contactId: c.id, dueDate: "2030-06-04" } }];
  let sentQuestion;
  await page.route("**/api/jarvis", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON(); sentQuestion = body.question;
    assert.equal(body.consent, true); assert.equal(body.allowScheduling, true); assert.equal(body.allowChanges, true); assert.equal(body.allowExternal, true);
    const review = await post("/api/reviews", { payload: { action: "schedule", items }, source: "Jarvis browser test" }); reviewIds.push(review.reviewId);
    const sources = [{ entity: "contacts", id: c.id, label: "JarvisBrowser Test", href: `/contacts/${c.id}` }];
    sqlite.prepare("INSERT INTO jarvis_turns (id, question, answer, status, model, time_zone, sources, drafts, review_id, usage) VALUES (?, ?, ?, 'complete', 'simulated-browser-test', 'America/Los_Angeles', ?, ?, ?, ?)").run(body.id, body.question, "Your task draft is ready for approval. It has not been saved.", JSON.stringify(sources), JSON.stringify(items), review.reviewId, JSON.stringify({ inputTokens: 10, outputTokens: 5, requests: 1 }));
    turns.push(body.id);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(await read(`/api/jarvis/${body.id}`)) });
  });
  await page.getByRole("button", { name: "Microphone", exact: true }).click();
  await page.getByRole("button", { name: "Stop microphone", exact: true }).waitFor();
  await page.evaluate(() => window.__jarvisRecognition.onresult({ results: [{ isFinal: true, 0: { transcript: "Draft a task for JarvisBrowser Test due June fourth 2030." } }] }));
  await page.getByText("Review before saving — drafts only", { exact: true }).waitFor();
  assert.equal(sentQuestion, "Draft a task for JarvisBrowser Test due June fourth 2030.");
  assert.equal((await read(`/api/tasks?q=${encodeURIComponent(taskTitle)}`)).count, 0, "Speaking must not approve a draft");
  assert.equal(await page.evaluate(() => window.__jarvisReadAloud), true);
  await page.getByText("Records Jarvis consulted (1)", { exact: true }).click();
  assert.equal(await page.getByRole("link", { name: "JarvisBrowser Test", exact: true }).getAttribute("href"), `/contacts/${c.id}`);
  await page.reload();
  await page.getByText("Review before saving — drafts only", { exact: true }).waitFor();
  assert.equal((await read("/api/jarvis")).items.length, 1, "History survives reload");
  const approved = page.waitForResponse((r) => r.url().endsWith("/api/import/apply") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Approve & save 1 item", exact: true }).click();
  assert.equal((await approved).status(), 200);
  await page.getByText("Approved changes applied", { exact: true }).waitFor();
  const tasks = await read(`/api/tasks?q=${encodeURIComponent(taskTitle)}`);
  assert.equal(tasks.count, 1); created.push(["tasks", tasks.items[0].id]);
  assert.equal(tasks.items[0].contactId, c.id);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.resolve("../../outputs/realtorpro-jarvis-desktop.png"), fullPage: true, animations: "disabled" });
  const phoneContext = await browser.newContext({ ...devices["iPhone 13"] });
  await phoneContext.addInitScript(() => { Object.defineProperty(window, "SpeechRecognition", { value: undefined }); Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined }); });
  const phone = await phoneContext.newPage(); phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base + "/jarvis");
  await phone.getByText("Microphone recognition is unavailable here.", { exact: false }).waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No mobile horizontal overflow");
  await phone.screenshot({ path: path.resolve("../../outputs/realtorpro-jarvis-mobile.png"), fullPage: true, animations: "disabled" });
  await phoneContext.close(); assert.deepEqual(errors, []);
  console.log("PASS real missing-key error, consent gate, simulated voice transcript/auto-send/read-aloud, real saved history/reload, approval-only task creation, record link, mobile fallback/layout; no browser exceptions. No live audio or paid Claude call tested.");
} finally {
  for (const id of turns) sqlite?.prepare("DELETE FROM jarvis_turns WHERE id = ?").run(id);
  for (const id of reviewIds) sqlite?.prepare("DELETE FROM reviews WHERE id = ?").run(id);
  for (const [entity, id] of created.reverse()) { const response = await context.request.delete(`${base}/api/${entity}/${id}`, { headers: { Origin: base } }); assert.ok(response.ok(), "Fixture cleanup failed"); }
  sqlite?.close(); await browser.close();
}
