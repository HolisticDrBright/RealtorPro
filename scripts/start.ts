import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { isOurAppReady, openAppBrowser, parsePort, portIsOpen } from "../src/lib/desktop";

async function main() {
loadEnvConfig(process.cwd());
const workspace = path.resolve(process.env.WORKSPACE_DIR || "./workspace");
fs.mkdirSync(workspace, { recursive: true });
const tokenFile = path.join(workspace, ".runtime-token");
if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
const token = fs.readFileSync(tokenFile, "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid local session file. Stop the app and remove only workspace/.runtime-token to recreate it.");
const mode = process.argv[2] === "start" ? "start" : "dev";
const port = parsePort(process.env.PORT);
const openBrowser = process.argv.includes("--open");
if (await portIsOpen(port)) {
  if (openBrowser && await isOurAppReady(port, token)) {
    await openAppBrowser(port); console.log("RealtorPro is already running. Keep its original Terminal window open."); return;
  }
  throw new Error(`Port ${port} is already in use. Close the other app instance or choose another PORT in .env. No process was stopped.`);
}
if (mode === "start" && !fs.existsSync(path.resolve(".next/BUILD_ID"))) throw new Error("RealtorPro needs its first build. Run the Set Up RealtorPro.command launcher on Mac, or npm run build.");
const child = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), mode, "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "inherit", windowsHide: true, env: { ...process.env, COMMAND_CENTER_TOKEN: token } });
let stopped = false;
child.on("error", () => { console.error("Could not start RealtorPro. Run setup and try again."); process.exitCode = 1; });
child.on("exit", () => { stopped = true; });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
if (openBrowser) {
  const deadline = Date.now() + 60000;
  while (!stopped && Date.now() < deadline) {
    if (await isOurAppReady(port, token)) { await openAppBrowser(port); console.log("RealtorPro is ready. Keep this window open; press Control-C to quit."); return; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log(`The app is taking longer to start. Check the messages above, then open http://127.0.0.1:${port}.`);
}
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Could not start RealtorPro."); process.exitCode = 1; });
