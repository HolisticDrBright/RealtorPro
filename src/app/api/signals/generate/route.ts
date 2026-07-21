import type { NextRequest } from "next/server";
import { db } from "@/db";
import { signals } from "@/db/schema.modules";
import { contacts } from "@/db/schema";
import { readJson } from "@/lib/api";
import { generateSignalsSchema } from "@/lib/validation.modules";
import { parseCsv } from "@/lib/csv-mapping";
import { signalsFromMlsExport, staleLeadSignal, type GeneratedSignal, type ContactLike } from "@/lib/signals";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Generate signals from an uploaded MLS status export and/or FUB contacts.
 * Only agent-approved sources are used; confidence reflects data completeness.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, generateSignalsSchema);
    const generated: GeneratedSignal[] = [];

    if (input.mlsExport) {
      const { rows } = parseCsv(input.mlsExport);
      // Map arbitrary headers to the fields the generator expects (best-effort).
      const norm = rows.map((r) => {
        const lower: Record<string, string> = {};
        for (const [k, v] of Object.entries(r)) lower[k.toLowerCase().replace(/[^a-z]/g, "")] = v;
        return { address: lower.address ?? "", status: lower.status ?? "", statusDate: lower.statusdate ?? lower.date ?? "", price: lower.price ?? "", owner: lower.owner ?? "", mls: lower.mls ?? lower.ml ?? "" };
      });
      generated.push(...signalsFromMlsExport(norm));
    }

    if (input.fromFub) {
      const cs = db.select().from(contacts).all();
      for (const c of cs) {
        // A conservative demo derivation: contacts whose sync note implies a pending push are "stale".
        const like: ContactLike = { id: c.id, name: c.name, lastTouchDaysAgo: /pending/i.test(c.syncStatus ?? "") ? 34 : null, stage: c.stage };
        const s = staleLeadSignal(like, input.staleThresholdDays);
        if (s) generated.push(s);
      }
    }

    const saved = generated.map((g) =>
      db
        .insert(signals)
        .values({ type: g.type, contactId: g.sourceKind === "fub" ? g.sourceRef : null, sourceKind: g.sourceKind, sourceRef: g.sourceRef, sourceDate: g.sourceDate, reason: g.reason, confidence: g.confidence, confidenceBasis: g.confidenceBasis, suggestedAction: g.suggestedAction, relatedLabel: g.relatedLabel, status: "new" })
        .returning()
        .get(),
    );

    writeAudit({ action: "signals.generate", metadata: { count: saved.length, fromFub: input.fromFub, fromMls: !!input.mlsExport } });
    return ok({ count: saved.length, signals: saved }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
