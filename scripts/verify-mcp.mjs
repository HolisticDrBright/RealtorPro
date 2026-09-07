import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import assert from "node:assert/strict";
const workspace = path.resolve(process.env.WORKSPACE_DIR || "../RealtorPro-browser-workspace");
if (!workspace.endsWith("RealtorPro-browser-workspace")) throw new Error("Use the isolated browser test workspace.");
const client = new Client({ name: "realtorpro-verification", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("scripts/mcp-server.ts")], cwd: process.cwd(), env: { ...process.env, WORKSPACE_DIR: workspace, COMMAND_CENTER_URL: process.env.TEST_URL || "http://127.0.0.1:3100" }, stderr: "pipe" });
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true, `MCP tool ${name} failed`);
  return JSON.parse(result.content.find((c) => c.type === "text").text);
};
try {
  await client.connect(transport);
  const listed = await client.listTools();
  assert.ok(!listed.tools.some((t) => /approve|restore|clear/.test(t.name)));
  const before = await call("list_records", { entity: "contacts" });
  assert.equal(before.count, 1);
  assert.equal(before.items[0].email, "browser-test@example.com");
  const p = await call("add_tasks", { tasks: [{ title: "MCP synthetic verification task", contactName: "Browser Test" }] });
  assert.equal(p.status, "pending");
  assert.equal((await call("list_records", { entity: "tasks" })).count, 0);
  for (const [name, args] of [
    ["create_record", { entity: "contacts", fields: { firstName: "Pending", lastName: "MCP" } }],
    ["update_record", { entity: "contacts", id: before.items[0].id, fields: { firstName: "Changed" } }],
    ["delete_record", { entity: "contacts", id: before.items[0].id }],
    ["log_activity", { contactId: before.items[0].id, type: "call", summary: "Synthetic proposed call" }],
  ]) { const result = await call(name, args); assert.equal(result.status, "pending"); }
  assert.deepEqual((await call("list_records", { entity: "contacts" })).items, before.items);
  console.log("PASS actual MCP stdio connection: reads work; task/create/update/delete/activity tools only create pending reviews");
} finally { await client.close(); }
