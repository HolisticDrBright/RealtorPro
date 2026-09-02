/**
 * MCP server for the Command Center — lets a Claude agent (Claude Desktop /
 * Cowork / Claude Code) read and write your records through the app's local
 * API. Runs over stdio; the app must be running (`npm run dev`).
 *
 *   npm run mcp            # start (used by the Claude config)
 *   npm run mcp:config     # print the JSON block for Claude Desktop / Cowork
 *
 * Every write goes through the same validation and business rules as the UI.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.COMMAND_CENTER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ENTITIES = ["contacts", "buyers", "sellers", "properties", "listings", "transactions", "milestones", "offers", "tasks", "calls", "appointments", "notes", "activities", "opportunities", "touchpoints", "notifications"] as const;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `${method} ${path} failed (${res.status})`);
  return data;
}
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

const server = new McpServer({ name: "command-center", version: "1.0.0" });

server.registerTool("get_dashboard", { description: "Today's full dashboard: KPIs, goal progress, priorities, schedule, call list, hot buyers, active listings, escrows, alerts, buyer matches.", inputSchema: {} }, async () => text(await call("GET", "/api/dashboard")));

server.registerTool("search", { description: "Search contacts, addresses, phone numbers, listings, transactions, notes, tasks and opportunities.", inputSchema: { q: z.string().min(1) } }, async ({ q }) => text(await call("GET", `/api/search?q=${encodeURIComponent(q)}`)));

server.registerTool("list_records", { description: "List rows of a collection with optional filters. Filters are exact-match on column names (e.g. {status:'active'} for listings, {type:'buyer'} for contacts); q does a text search.", inputSchema: { entity: z.enum(ENTITIES), filters: z.record(z.string()).optional(), q: z.string().optional(), limit: z.number().int().min(1).max(500).optional() } }, async ({ entity, filters, q, limit }) => {
  const p = new URLSearchParams({ ...(filters ?? {}), ...(q ? { q } : {}), limit: String(limit ?? 100) });
  return text(await call("GET", `/api/${entity}?${p}`));
});

server.registerTool("get_record", { description: "Fetch one row by id.", inputSchema: { entity: z.enum(ENTITIES), id: z.string() } }, async ({ entity, id }) => text(await call("GET", `/api/${entity}/${id}`)));

server.registerTool("create_record", { description: "Create one row. Fields follow the app schema (contacts: firstName, lastName, phone, email, type, leadSource…; tasks: title, priority, category, dueDate, dueTime, contactId…; listings: propertyId, listPrice, status…). Prefer import_records when adding several related records at once.", inputSchema: { entity: z.enum(ENTITIES), fields: z.record(z.unknown()) } }, async ({ entity, fields }) => text(await call("POST", `/api/${entity}`, fields)));

server.registerTool("update_record", { description: "Patch fields on one row (e.g. mark a task done with {completedAt: ISO}, move a listing with {status:'in_escrow'}, set a contact's nextFollowUpAt).", inputSchema: { entity: z.enum(ENTITIES), id: z.string(), fields: z.record(z.unknown()) } }, async ({ entity, id, fields }) => text(await call("PATCH", `/api/${entity}/${id}`, fields)));

server.registerTool("delete_record", { description: "Delete one row. Ask the user before deleting anything important.", inputSchema: { entity: z.enum(ENTITIES), id: z.string() } }, async ({ entity, id }) => text(await call("DELETE", `/api/${entity}/${id}`)));

server.registerTool("import_records", {
  description: "Upsert a batch of related records by natural keys (contacts by email/phone/name, properties by address, listings by property, transactions by property+price). Use this after finding new MLS deals or reading email: pass listings/properties/contacts/tasks/notes together. Set dryRun=true first to preview.",
  inputSchema: {
    dryRun: z.boolean().default(false),
    source: z.string().default("Claude"),
    contacts: z.array(z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional(), type: z.string().optional(), leadSource: z.string().optional(), priceMin: z.number().optional(), priceMax: z.number().optional(), preferredAreas: z.array(z.string()).optional(), notes: z.string().optional(), nextFollowUpAt: z.string().optional(), buyer: z.record(z.unknown()).optional(), seller: z.record(z.unknown()).optional() })).optional(),
    properties: z.array(z.object({ address: z.string(), city: z.string().optional(), zip: z.string().optional(), beds: z.number().optional(), baths: z.number().optional(), sqft: z.number().optional(), lotSqft: z.number().optional(), propertyType: z.string().optional(), yearBuilt: z.number().optional(), view: z.string().optional(), notes: z.string().optional() })).optional(),
    listings: z.array(z.object({ address: z.string(), city: z.string().optional(), listPrice: z.number(), status: z.string().optional(), listedAt: z.string().optional(), sellerName: z.string().optional(), notes: z.string().optional(), nextAction: z.string().optional() })).optional(),
    transactions: z.array(z.object({ address: z.string(), clientName: z.string().optional(), side: z.string().optional(), status: z.string().optional(), purchasePrice: z.number(), commissionPct: z.number().optional(), escrowOpenedAt: z.string().optional(), closingDate: z.string().optional(), closedAt: z.string().optional(), notes: z.string().optional() })).optional(),
    tasks: z.array(z.object({ title: z.string(), priority: z.string().optional(), category: z.string().optional(), dueDate: z.string().optional(), dueTime: z.string().optional(), contactName: z.string().optional(), address: z.string().optional(), notes: z.string().optional() })).optional(),
    opportunities: z.array(z.object({ address: z.string(), area: z.string().optional(), kind: z.string().optional(), expectedPrice: z.number().optional(), beds: z.number().optional(), baths: z.number().optional(), sqft: z.number().optional(), sourceAgent: z.string().optional(), notes: z.string().optional() })).optional(),
    notes: z.array(z.object({ body: z.string(), contactName: z.string().optional(), address: z.string().optional() })).optional(),
  },
}, async ({ dryRun, source, ...bundle }) => {
  if (dryRun) return text(await call("POST", "/api/import/preview", { bundle, source }));
  return text(await call("POST", "/api/import/apply", { bundle, source }));
});

server.registerTool("add_tasks", { description: "Add to-dos to today's dashboard (e.g. from email). Each: title, optional priority (critical|high|medium|low), category, dueDate (YYYY-MM-DD, default today), dueTime (HH:MM), contactName, notes.", inputSchema: { tasks: z.array(z.object({ title: z.string(), priority: z.string().optional(), category: z.string().optional(), dueDate: z.string().optional(), dueTime: z.string().optional(), contactName: z.string().optional(), notes: z.string().optional() })) } }, async ({ tasks }) => {
  const today = new Date().toISOString().slice(0, 10);
  return text(await call("POST", "/api/import/apply", { source: "Claude", bundle: { tasks: tasks.map((t) => ({ ...t, dueDate: t.dueDate ?? today })) } }));
});

server.registerTool("log_activity", { description: "Log a touch on a contact's timeline (call, text, email, meeting, note) and update their last-contact date.", inputSchema: { contactId: z.string(), type: z.enum(["call", "text", "email", "showing", "meeting", "note"]), summary: z.string() } }, async ({ contactId, type, summary }) => {
  await call("POST", "/api/activities", { contactId, type, summary, occurredAt: new Date().toISOString() });
  return text(await call("PATCH", `/api/contacts/${contactId}`, { lastContactAt: new Date().toISOString() }));
});

async function main() {
if (process.argv.includes("--config")) {
  const cfg = { mcpServers: { "command-center": { command: "npm", args: ["run", "--silent", "mcp"], cwd: process.cwd(), env: { COMMAND_CENTER_URL: BASE } } } };
  console.log(JSON.stringify(cfg, null, 2));
  console.log(`\nPaste the "command-center" entry into Claude Desktop / Cowork → Settings → Developer → Edit Config, or run:\n  claude mcp add command-center --cwd "${process.cwd()}" -- npm run --silent mcp`);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
}
main().catch((err) => { console.error(err); process.exit(1); });
