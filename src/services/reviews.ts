import "server-only";
import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { schemas, tables, type EntityName } from "@/lib/registry";
import { AppError } from "@/lib/errors";
import { ImportBundle, applyImport, type ImportBundleT } from "./importer";
import { afterCreate, afterUpdate } from "./hooks";
import { createBackup } from "./backups";
import { ScheduleItems, validateSchedule } from "./scheduling";
import { RecordBatch } from "@/lib/agent-records";
import { VaultWriteProposal, validateVaultWrite, applyVaultWrite } from "./jarvis-vault";
import { GoogleEventProposal, validateGoogleProposal, applyGoogleEvent } from "./google-calendar";

export const Proposal = z.discriminatedUnion("action", [
  z.object({ action: z.literal("batch"), items: RecordBatch }).strict(),
  VaultWriteProposal,
  GoogleEventProposal,
  z.object({ action: z.literal("schedule"), items: ScheduleItems }),
  z.object({ action: z.literal("import"), bundle: ImportBundle }),
  z.object({ action: z.enum(["create", "update", "delete"]), entity: z.string(), id: z.string().optional(), fields: z.record(z.unknown()).default({}) }),
]);
type ProposalT = z.infer<typeof Proposal>;
function fingerprint(payload?: ProposalT) {
  const changingAlerts = payload?.action === "batch" ? payload.items.some((i) => i.entity === "notifications" && i.action !== "create") : payload && "entity" in payload && payload.entity === "notifications" && payload.action !== "create";
  const hash = createHash("sha256");
  for (const [name, table] of Object.entries(tables)) {
    if (name === "notifications" && !changingAlerts) continue;
    const rows = db.select().from(table).all() as { id: string }[];
    hash.update(name + JSON.stringify(rows.sort((a, b) => a.id.localeCompare(b.id))));
  }
  return hash.digest("hex");
}
function execute(p: ProposalT): unknown {
  if (p.action === "vault_write") return validateVaultWrite(p);
  if (p.action === "google_event") return validateGoogleProposal(p);
  if (p.action === "batch") {
    const refs = new Map<string, { id: string; entity: string }>();
    const fk: Record<string, string> = { contactId: "contacts", sellerContactId: "contacts", propertyId: "properties", listingId: "listings", transactionId: "transactions" };
    return p.items.map((item) => {
      if (item.ref && (item.action !== "create" || refs.has(item.ref))) throw new AppError("validation_error", "Use each temporary reference once, on a new record.");
      const fields = Object.fromEntries(Object.entries(item.fields).map(([key, value]) => {
        if (typeof value === "string" && value.startsWith("@ref:")) { const ref = refs.get(value.slice(5)); if (!ref || ref.entity !== fk[key]) throw new AppError("validation_error", "Use a matching earlier create reference only in a related-record ID field."); return [key, ref.id]; }
        return [key, value];
      }));
      const result = execute({ action: item.action, entity: item.entity, id: item.id, fields }) as { after?: { id: string } };
      if (item.ref && result.after) refs.set(item.ref, { id: result.after.id, entity: item.entity });
      return result;
    });
  }
  if (p.action === "schedule") return validateSchedule(p.items).map((item) => execute({ action: "create", entity: item.entity, fields: item.fields }));
  if (p.action === "import") return applyImport(p.bundle);
  if (!Object.prototype.hasOwnProperty.call(tables, p.entity) || (p.entity === "settings" && p.action !== "update")) throw new AppError("bad_request", "Unsupported agent collection/action. Profile settings can only be updated.");
  const entity = p.entity as EntityName, t = tables[entity];
  const idCol = (t as unknown as { id: never }).id;
  if (p.action === "create") {
    const fields = schemas[entity].strict().parse(p.fields);
    validateFields(entity, fields as Record<string, unknown>);
    const row = db.insert(t).values(fields as never).returning().get();
    afterCreate(entity, row as never); return { after: row };
  }
  if (!p.id) throw new AppError("bad_request", "Record ID is required.");
  const before = db.select().from(t).where(eq(idCol, p.id)).get();
  if (!before) throw new AppError("not_found", "That record no longer exists.");
  if (p.action === "delete") { db.delete(t).where(eq(idCol, p.id)).run(); return { before, deleted: true }; }
  const fields = schemas[entity].partial().strict().parse(p.fields);
  validateFields(entity, { ...before, ...fields }, p.id);
  db.update(t).set({ ...fields, ...("updatedAt" in t ? { updatedAt: new Date().toISOString() } : {}) } as never).where(eq(idCol, p.id)).run();
  const after = db.select().from(t).where(eq(idCol, p.id)).get();
  afterUpdate(entity, before as never, after as never); return { before, after };
}
function validateFields(entity: EntityName, fields: Record<string, unknown>, id?: string) {
  for (const [key, value] of Object.entries(fields)) {
    if (value && /^(dueDate|scheduledDate|closingDate|birthday)$/.test(key)) {
      const day = String(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new AppError("validation_error", `${key} must be a real YYYY-MM-DD date.`);
    }
    if (value && /^(dueTime|scheduledTime)$/.test(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) throw new AppError("validation_error", `${key} must be HH:mm.`);
  }
  if (entity === "notifications" && fields.href && !/^\/(?!\/)[^\s\\]*$/.test(String(fields.href))) throw new AppError("validation_error", "Alert links must point inside RealtorPro.");
  if (entity === "appointments") {
    const allowed = ["title", "type", "startsAt", "endsAt", "location", "contactId", "propertyId", "notes"];
    validateSchedule([{ entity, fields: Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k))) }], id);
  }
}
export function propose(payload: ProposalT, source = "Claude") {
  const rollback = Symbol("preview");
  let preview: unknown;
  try { db.transaction(() => { preview = execute(payload); throw rollback; }); } catch (e) { if (e !== rollback) throw e; }
  const row = db.insert(reviews).values({ source, payload: JSON.stringify(payload), preview: JSON.stringify(preview), fingerprint: fingerprint(payload) }).returning().get();
  return { reviewId: row.id, report: preview, preview, status: "pending", reviewUrl: "/reviews" };
}
export const proposeImport = (bundle: ImportBundleT, source: string) => propose({ action: "import", bundle }, source);
export function listReviews() { return db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(100).all().map((r) => ({ ...r, payload: JSON.parse(r.payload), preview: JSON.parse(r.preview), result: r.result ? JSON.parse(r.result) : null })); }
const applying = new Set<string>();
export async function decideReview(id: string, approve: boolean) {
  if (applying.has(id)) throw new AppError("conflict", "This review is already being applied. Wait and refresh.");
  applying.add(id);
  try { return await decide(id, approve); } finally { applying.delete(id); }
}
async function decide(id: string, approve: boolean) {
  let row = db.select().from(reviews).where(eq(reviews.id, id)).get();
  if (!row) throw new AppError("not_found", "Review not found.");
  const payload = Proposal.parse(JSON.parse(row.payload));
  if (row.status === "applied" && approve) return JSON.parse(row.result!);
  if (row.status !== "pending") throw new AppError("conflict", "This review has already been closed.");
  if (!approve) { db.update(reviews).set({ status: "rejected", updatedAt: new Date().toISOString() }).where(eq(reviews.id, id)).run(); return { rejected: true }; }
  if (Date.now() - Date.parse(row.createdAt.replace(" ", "T") + (row.createdAt.endsWith("Z") ? "" : "Z")) > 86400000) throw new AppError("conflict", "This preview is more than a day old. Generate a fresh preview.");
  if (fingerprint(payload) !== row.fingerprint) throw new AppError("conflict", "Records changed since this preview. Generate a fresh preview before approving.");
  const backup = await createBackup();
  if (payload.action === "vault_write" || payload.action === "google_event") {
    if (fingerprint(payload) !== row.fingerprint) throw new AppError("conflict", "Records changed while backing up. Generate a fresh preview.");
    const report = payload.action === "vault_write" ? applyVaultWrite(payload, id) : await applyGoogleEvent(payload, id);
    const result = { report, backup: backup.id };
    db.update(reviews).set({ status: "applied", result: JSON.stringify(result), updatedAt: new Date().toISOString() }).where(eq(reviews.id, id)).run();
    return result;
  }
  return db.transaction(() => {
    row = db.select().from(reviews).where(eq(reviews.id, id)).get()!;
    if (row.status === "applied") return JSON.parse(row.result!);
    if (row.status !== "pending" || fingerprint(payload) !== row.fingerprint) throw new AppError("conflict", "Records changed while backing up. Generate a fresh preview.");
    const report = execute(Proposal.parse(JSON.parse(row.payload)));
    const result = { report, backup: backup.id };
    db.update(reviews).set({ status: "applied", result: JSON.stringify(result), updatedAt: new Date().toISOString() }).where(eq(reviews.id, id)).run();
    return result;
  });
}
