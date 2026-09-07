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

export const Proposal = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import"), bundle: ImportBundle }),
  z.object({ action: z.enum(["create", "update", "delete"]), entity: z.string(), id: z.string().optional(), fields: z.record(z.unknown()).default({}) }),
]);
type ProposalT = z.infer<typeof Proposal>;
function fingerprint() {
  const hash = createHash("sha256");
  for (const [name, table] of Object.entries(tables)) {
    if (name === "notifications") continue;
    const rows = db.select().from(table).all() as { id: string }[];
    hash.update(name + JSON.stringify(rows.sort((a, b) => a.id.localeCompare(b.id))));
  }
  return hash.digest("hex");
}
function execute(p: ProposalT): unknown {
  if (p.action === "import") return applyImport(p.bundle);
  if (!Object.prototype.hasOwnProperty.call(tables, p.entity) || p.entity === "settings") throw new AppError("bad_request", "Unsupported agent collection.");
  const entity = p.entity as EntityName, t = tables[entity];
  const idCol = (t as unknown as { id: never }).id;
  if (p.action === "create") {
    const fields = schemas[entity].parse(p.fields);
    const row = db.insert(t).values(fields as never).returning().get();
    afterCreate(entity, row as never); return { after: row };
  }
  if (!p.id) throw new AppError("bad_request", "Record ID is required.");
  const before = db.select().from(t).where(eq(idCol, p.id)).get();
  if (!before) throw new AppError("not_found", "That record no longer exists.");
  if (p.action === "delete") { db.delete(t).where(eq(idCol, p.id)).run(); return { before, deleted: true }; }
  const fields = schemas[entity].partial().parse(p.fields);
  db.update(t).set({ ...fields, ...("updatedAt" in t ? { updatedAt: new Date().toISOString() } : {}) } as never).where(eq(idCol, p.id)).run();
  const after = db.select().from(t).where(eq(idCol, p.id)).get();
  afterUpdate(entity, before as never, after as never); return { before, after };
}
export function propose(payload: ProposalT, source = "Claude") {
  const rollback = Symbol("preview");
  let preview: unknown;
  try { db.transaction(() => { preview = execute(payload); throw rollback; }); } catch (e) { if (e !== rollback) throw e; }
  const row = db.insert(reviews).values({ source, payload: JSON.stringify(payload), preview: JSON.stringify(preview), fingerprint: fingerprint() }).returning().get();
  return { reviewId: row.id, report: preview, preview, status: "pending", reviewUrl: "/reviews" };
}
export const proposeImport = (bundle: ImportBundleT, source: string) => propose({ action: "import", bundle }, source);
export function listReviews() { return db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(100).all().map((r) => ({ ...r, payload: JSON.parse(r.payload), preview: JSON.parse(r.preview), result: r.result ? JSON.parse(r.result) : null })); }
export async function decideReview(id: string, approve: boolean) {
  let row = db.select().from(reviews).where(eq(reviews.id, id)).get();
  if (!row) throw new AppError("not_found", "Review not found.");
  if (row.status === "applied" && approve) return JSON.parse(row.result!);
  if (row.status !== "pending") throw new AppError("conflict", "This review has already been closed.");
  if (!approve) { db.update(reviews).set({ status: "rejected", updatedAt: new Date().toISOString() }).where(eq(reviews.id, id)).run(); return { rejected: true }; }
  if (Date.now() - Date.parse(row.createdAt.replace(" ", "T") + (row.createdAt.endsWith("Z") ? "" : "Z")) > 86400000) throw new AppError("conflict", "This preview is more than a day old. Generate a fresh preview.");
  if (fingerprint() !== row.fingerprint) throw new AppError("conflict", "Records changed since this preview. Generate a fresh preview before approving.");
  const backup = await createBackup();
  return db.transaction(() => {
    row = db.select().from(reviews).where(eq(reviews.id, id)).get()!;
    if (row.status === "applied") return JSON.parse(row.result!);
    if (row.status !== "pending" || fingerprint() !== row.fingerprint) throw new AppError("conflict", "Records changed while backing up. Generate a fresh preview.");
    const report = execute(Proposal.parse(JSON.parse(row.payload)));
    const result = { report, backup: backup.id };
    db.update(reviews).set({ status: "applied", result: JSON.stringify(result), updatedAt: new Date().toISOString() }).where(eq(reviews.id, id)).run();
    return result;
  });
}
