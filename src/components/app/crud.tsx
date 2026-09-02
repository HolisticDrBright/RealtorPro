"use client";

import { useState, type ReactNode } from "react";
import { api, toast } from "@/lib/client";
import { Confirm } from "@/components/ui/primitives";
import { FormPanel } from "@/components/ui/form";
import { ENTITY_LABEL, FIELDS } from "./entities";

/**
 * Per-page CRUD helper: one slide-over for add/edit, one confirm for delete.
 *   const crud = useCrud("tasks");
 *   <button onClick={() => crud.openNew()} /> … {crud.panel}
 */
export function useCrud(entity: string, opts?: { onSaved?: (item: Record<string, unknown>) => void; titleFor?: (item: Record<string, unknown> | null) => string }) {
  const [editing, setEditing] = useState<Record<string, unknown> | null | undefined>(undefined); // undefined = closed, null = new
  const [confirm, setConfirm] = useState<{ id: string; label: string } | null>(null);
  const label = ENTITY_LABEL[entity] ?? "Record";
  const openNew = (initial?: Record<string, unknown>) => setEditing(initial ? { ...initial } : null);
  const openEdit = (item: Record<string, unknown>) => setEditing(item);
  const close = () => setEditing(undefined);
  const remove = (id: string, itemLabel = label) => setConfirm({ id, label: itemLabel });
  const panel: ReactNode = (
    <>
      <FormPanel open={editing !== undefined} onClose={close} entity={entity} fields={FIELDS[entity] ?? []} initial={editing && "id" in editing ? editing : editing ?? null} title={opts?.titleFor ? opts.titleFor(editing ?? null) : editing && "id" in editing ? `Edit ${label}` : `New ${label}`} onSaved={opts?.onSaved} />
      <Confirm open={!!confirm} title={`Delete ${confirm?.label ?? label}?`} body="This can't be undone. Related history stays attached to the client where possible." onCancel={() => setConfirm(null)} onConfirm={async () => { if (!confirm) return; const r = await api.remove(entity, confirm.id); toast(r.ok ? "Deleted" : r.message ?? "Could not delete", r.ok ? "ok" : "err"); setConfirm(null); }} />
    </>
  );
  return { openNew, openEdit, close, remove, panel, editing };
}

export function RowMenu({ onEdit, onDelete, extra }: { onEdit?: () => void; onDelete?: () => void; extra?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {extra}
      {onEdit && <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>}
      {onDelete && <button className="btn btn-ghost btn-sm text-crit" onClick={onDelete}>Delete</button>}
    </span>
  );
}
