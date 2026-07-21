import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * Append an entry to the audit log.
 *
 * Audit entries are written for every import, generated draft, approval, export,
 * and FUB write, per the reliability requirements. This is append-only; audit
 * rows are never updated or deleted by the app.
 */
export interface AuditInput {
  action: string;
  actor?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export function writeAudit(input: AuditInput) {
  return db
    .insert(auditLogs)
    .values({
      action: input.action,
      actor: input.actor ?? "agent",
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    })
    .returning()
    .get();
}
