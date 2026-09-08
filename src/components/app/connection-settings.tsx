"use client";
import { useState } from "react";
import { api, toast, useApi } from "@/lib/client";
import { Card } from "@/components/ui/primitives";

interface Profile { id: string; agentName: string; brokerage: string | null; annualGoal: number; defaultCommissionPct: number; defaultSplitPct: number }
export function ProfileSettings() {
  const { data } = useApi<{ items: Profile[] }>("/api/settings");
  const [busy, setBusy] = useState(false);
  const row = data?.items[0];
  if (!row) return null;
  return <Card className="mb-4" title="Your profile & income goal"><form className="grid md:grid-cols-3 gap-3 text-[13px]" key={JSON.stringify(row)} onSubmit={async (event) => {
    event.preventDefault(); setBusy(true);
    const f = new FormData(event.currentTarget);
    const r = await api.update("settings", row.id, { agentName: f.get("agentName"), brokerage: f.get("brokerage"), annualGoal: Number(f.get("annualGoal")) });
    toast(r.ok ? "Profile saved" : r.message || "Profile failed", r.ok ? "ok" : "err"); setBusy(false);
  }}>
    <label>Your name<input className="input mt-1" name="agentName" defaultValue={row.agentName} required maxLength={200} /></label>
    <label>Brokerage<input className="input mt-1" name="brokerage" defaultValue={row.brokerage || ""} maxLength={200} /></label>
    <label>Annual net-income goal ($)<input className="input mt-1" name="annualGoal" type="number" min="0" step="100" defaultValue={row.annualGoal} required /></label>
    <div className="self-end"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button></div>
  </form></Card>;
}

export interface ClaudeConnectionStatus { model: string; configured: boolean; verifiedAt: string | null; storage: string; secureStorage: string; canSaveKey: boolean; needsReconnect: boolean; platform: string }
export function ClaudeSettings({ model, configured, verifiedAt, storage, secureStorage, canSaveKey, needsReconnect, platform, reload }: ClaudeConnectionStatus & { reload: () => void }) {
  const [key, setKey] = useState("");
  const [modelId, setModelId] = useState(model);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  async function save(disconnect = false) {
    setBusy(true);
    try {
      const r = await api.post<{ warning?: string | null }>("/api/integrations/connect", { kind: "claude", key: key || undefined, model: modelId, disconnect });
      if (r.ok) { setKey(""); setWarning(r.data.warning || null); toast(disconnect ? "Claude disconnected" : "Claude key and model verified. Connection saved."); reload(); }
      else toast(r.message ?? "Connection failed", "err");
    } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg bg-ground p-4 text-[13px]">
    <p>Connect your own Anthropic API account. API use is billed separately from a Claude subscription. No restart needed.</p>
    <p className="font-medium">Secure storage: {secureStorage}{configured ? ` · Currently using: ${storage}` : ""}</p>
    {platform === "darwin" && <p>macOS may ask you to unlock your login keychain or allow RealtorPro access. Your Mac login password belongs only in the macOS dialog, never in this form.</p>}
    {!canSaveKey && <p role="status" className="text-ink-2">{platform === "darwin" ? "Keychain support needs setup. Quit RealtorPro, double-click Set Up RealtorPro.command, then return here." : "Use an environment API key on this operating system. In-app key storage supports Mac and Windows."}</p>}
    {needsReconnect && <p role="alert">This saved connection belongs to another operating system. Paste the API key again to reconnect securely on this computer.</p>}
    {warning && <p role="alert">{warning}</p>}
    <label className="block">Anthropic API key<input className="input mt-1" type="password" autoComplete="new-password" spellCheck={false} placeholder={configured ? "Leave blank to test the saved key" : "Paste API key"} value={key} onChange={(e) => setKey(e.target.value)} /></label>
    <label className="block">Claude model ID<input className="input mt-1" value={modelId} onChange={(e) => setModelId(e.target.value)} spellCheck={false} /></label>
    <div className="flex gap-2 flex-wrap"><button className="btn btn-primary" disabled={busy || !canSaveKey || (!key && !configured)} onClick={() => save()}>{busy ? "Checking…" : "Save & test Claude"}</button>{configured && <button className="btn" disabled={busy} onClick={() => save(true)}>Disconnect Claude</button>}<a className="card-link self-center" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Get an API key ↗</a></div>
    <p className="text-ink-3 text-xs">Saved keys are protected by your operating system, never returned to the browser and excluded from database backups. The connection test checks key/model access; it does not generate paid content or verify your credit balance.{verifiedAt ? ` Last checked: ${new Date(verifiedAt).toLocaleString()}.` : ""}</p>
  </div>;
}

interface FolderListing { path: string; parent: string; isVault: boolean; folders: { name: string; path: string }[] }
export function VaultSettings({ dir, include = [], exclude = [], allowClaude, isMac = false, reload }: { dir: string | null; include?: string[]; exclude?: string[]; allowClaude: boolean; isMac?: boolean; reload: () => void }) {
  const [vaultPath, setVaultPath] = useState(dir || "");
  const [included, setIncluded] = useState(include.join(", "));
  const [excluded, setExcluded] = useState(exclude.join(", "));
  const [allow, setAllow] = useState(allowClaude);
  const [folders, setFolders] = useState<FolderListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  async function chooseFolder() {
    setChoosing(true);
    try {
      const r = await api.post<{ path: string | null }>("/api/integrations/vault-picker");
      if (r.ok && r.data.path) { setVaultPath(r.data.path); setFolders(null); toast("Folder selected. Choose Save & connect vault to confirm."); }
      else if (!r.ok) toast(r.message || "Cannot open folder chooser", "err");
    } finally { setChoosing(false); }
  }
  async function browse(folder?: string) {
    const r = await api.get<FolderListing>(`/api/integrations/folders${folder ? `?path=${encodeURIComponent(folder)}` : ""}`);
    if (r.ok) setFolders(r.data); else toast(r.message || "Cannot browse folder", "err");
  }
  async function save(disconnect = false) {
    setBusy(true);
    const split = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);
    try {
      const r = await api.post("/api/integrations/connect", { kind: "vault", dir: vaultPath, include: split(included), exclude: split(excluded), allowClaude: allow, disconnect });
      if (r.ok) { toast(disconnect ? "Vault disconnected. Original notes were not changed." : "Vault connected and indexed"); if (disconnect) { setVaultPath(""); setAllow(false); } reload(); }
      else toast(r.message || "Connection failed", "err");
    } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg bg-ground p-4 text-[13px] mb-3">
    {isMac && <div className="space-y-2"><button className="btn btn-primary" disabled={choosing || busy} onClick={chooseFolder}>{choosing ? "Choose a folder in the Mac dialog…" : "Choose vault on this Mac…"}</button><p className="text-xs text-ink-3">Choose the vault root, not an individual note. If macOS asks, allow access to that folder. iCloud notes must be downloaded to this Mac. You can also browse below.</p></div>}
    <label className="block">Vault folder<div className="flex gap-2 mt-1"><input className="input min-w-0" value={vaultPath} onChange={(e) => setVaultPath(e.target.value)} placeholder="Choose your Obsidian vault folder" /><button className="btn" onClick={() => browse(vaultPath || undefined)}>Browse folders</button></div></label>
    {folders && <div className="border border-line rounded-lg p-3 space-y-2" role="region" aria-label="Vault folder browser"><p className="break-all">{folders.path}</p><div className="flex gap-2"><button className="btn" onClick={() => browse(folders.parent)}>Up one folder</button><button className="btn btn-primary" disabled={!folders.isVault} onClick={() => { setVaultPath(folders.path); setFolders(null); }}>Use this vault</button><button className="btn" onClick={() => setFolders(null)}>Close</button></div>{!folders.isVault && <p className="text-ink-3">Open a vault root containing the hidden .obsidian folder.</p>}<div className="max-h-52 overflow-y-auto">{folders.folders.map((f) => <button key={f.path} className="block w-full text-left p-2 hover:bg-paper" onClick={() => browse(f.path)}>▸ {f.name}</button>)}</div></div>}
    <details><summary className="cursor-pointer">Folder privacy controls</summary><label className="block mt-2">Include only (comma-separated; blank = all)<input className="input mt-1" value={included} onChange={(e) => setIncluded(e.target.value)} placeholder="Clients, Properties" /></label><label className="block mt-2">Exclude folders<input className="input mt-1" value={excluded} onChange={(e) => setExcluded(e.target.value)} placeholder="Personal, Journals" /></label></details>
    <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={allow} onChange={(e) => setAllow(e.target.checked)} /><span>Allow selected vault text to be sent to Anthropic for extraction, briefings and Ask Jarvis. Jarvis can propose note edits for approval. Off keeps original vault text local. Records you explicitly import into the CRM may later be included in AI features.</span></label>
    <div className="flex gap-2 flex-wrap"><button className="btn btn-primary" disabled={busy || choosing || !vaultPath} onClick={() => save()}>{busy ? "Connecting…" : "Save & connect vault"}</button>{dir && <button className="btn" disabled={busy || choosing} onClick={() => save(true)}>Disconnect vault</button>}</div>
    <p className="text-xs text-ink-3">Reads Markdown files in place. Original notes are never modified by indexing or importing. Disconnect removes the local note index; already imported CRM records stay.</p>
  </div>;
}
