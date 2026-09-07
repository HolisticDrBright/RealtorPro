import { execFile } from "node:child_process";
import net from "node:net";

export function parsePort(value = "3000"): number {
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error("PORT must be a number between 1024 and 65535.");
  return Number(value);
}
export async function portIsOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open: boolean) => { socket.destroy(); resolve(open); };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true)); socket.once("error", () => finish(false)); socket.once("timeout", () => finish(false));
  });
}
export async function isOurAppReady(port: number, token: string): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2000), redirect: "error" });
    if (!r.ok) return false;
    const data = await r.json();
    return data.status === "healthy" && data.mode === "private-local";
  } catch { return false; }
}
export function openAppBrowser(port: number): Promise<void> {
  // No user-supplied URL and no shell evaluation.
  const url = `http://127.0.0.1:${parsePort(String(port))}/integrations`;
  return new Promise((resolve, reject) => {
    if (process.platform === "darwin") execFile("/usr/bin/open", [url], (err) => err ? reject(new Error(`Open ${url} in your browser.`)) : resolve());
    else { console.log(`Open ${url} in your browser.`); resolve(); }
  });
}
