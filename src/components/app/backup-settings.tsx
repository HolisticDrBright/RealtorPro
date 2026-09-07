"use client";
import { useState } from "react";
import { api, toast, useApi } from "@/lib/client";
import { Card } from "@/components/ui/primitives";
export function BackupSettings() {
  const { data, error, reload } = useApi<{ backups: { id: string; createdAt: string; bytes: number }[] }>("/api/backups");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [confirm, setConfirm] = useState("");
  async function run(action: "create" | "restore") {
    setBusy(true);
    try { const r = await api.post("/api/backups", { action, id: selected, confirm }); if (r.ok) { toast(action === "create" ? "Database backup created and verified" : "Backup restored. A safety copy of the previous database was kept."); setSelected(""); setConfirm(""); reload(); } else toast(r.message || "Backup operation failed", "err"); }
    finally { setBusy(false); }
  }
  return <Card className="mt-4" title="Backups & recovery"><div className="text-[13px] space-y-3">
    <p className="text-ink-2">Verified database snapshots are saved before approved AI changes and clearing records. They contain private CRM data; keep your workspace protected. These do not back up your original Obsidian files or API keys. Keep an additional copy on another drive.</p>
    <button className="btn" disabled={busy} onClick={() => run("create")}>{busy ? "Working…" : "Create backup now"}</button>
    {error && <p role="alert">{error}</p>}
    <label className="block">Restore an existing snapshot<select className="input mt-1" value={selected} onChange={(e) => { setSelected(e.target.value); setConfirm(""); }}><option value="">Choose a backup…</option>{data?.backups.map((b) => <option key={b.id} value={b.id}>{new Date(b.createdAt).toLocaleString()} · {Math.round(b.bytes / 1024)} KB · {b.id.slice(0, 8)}</option>)}</select></label>
    {selected && <div className="rounded border border-line p-3 space-y-2"><p>Restore replaces current CRM records with this snapshot. A safety backup is created first. Pending reviews in the restored copy are rejected.</p><label className="block">Type RESTORE to continue<input className="input mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label><button className="btn" disabled={busy || confirm !== "RESTORE"} onClick={() => run("restore")}>Restore selected backup</button></div>}
  </div></Card>;
}
