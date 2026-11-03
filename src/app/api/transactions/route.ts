import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { transactions } from "@/db/schema.dashboard";
import { readJson } from "@/lib/api";
import { createTransactionSchema } from "@/lib/validation.checklist";
import { instantiateChecklist, itemsFor, summaryFor } from "@/services/checklist";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** List transactions (active + pending by default; `?all=1` includes closed/canceled) with checklist progress. */
export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get("all") === "1";
    const contactRows = db.select({ id: contacts.id, name: contacts.name }).from(contacts).all();
    const rows = db.select().from(transactions).orderBy(desc(transactions.createdAt)).all().filter((t) => all || t.status === "active" || t.status === "pending");
    return ok({
      transactions: rows.map((t) => {
        const items = itemsFor(t.id);
        return { ...t, contactName: contactRows.find((c) => c.id === t.contactId)?.name ?? null, checklist: items.length ? summaryFor(t, items) : null };
      }),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create a transaction and instantiate the default checklist for its side. */
export async function POST(req: NextRequest) {
  try {
    const { templateKey, ...input } = await readJson(req, createTransactionSchema);
    const row = db.insert(transactions).values(input).returning().get();
    writeAudit({ action: "transaction.created", entityType: "transaction", entityId: row.id, metadata: { side: row.side, address: row.address } });
    const { template, items } = instantiateChecklist(row.id, { templateKey });
    const tx = { ...row, checklistTemplateId: template.id };
    return ok({ transaction: tx, items, summary: summaryFor(tx, items) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
