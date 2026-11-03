import { z } from "zod";
import { CONDITIONS } from "@/data/checklist-templates";

/** Zod schemas for the transaction-checklist routes. */

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const ymdOrNull = ymdSchema.nullable();

/** `flags` is a record of booleans whose keys must be checklist conditions. */
export const flagsSchema = z
  .record(z.boolean())
  .superRefine((v, ctx) => {
    for (const k of Object.keys(v)) if (!(CONDITIONS as readonly string[]).includes(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown condition "${k}".`, path: [k] });
  });

export const itemStatusSchema = z.enum(["pending", "done", "na", "waived"]);

export const createTransactionSchema = z.object({
  side: z.enum(["listing", "buyer"]),
  address: z.string().min(1).max(300),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  price: z.number().nonnegative().optional(),
  stage: z.string().max(120).optional(),
  status: z.enum(["active", "pending", "closed", "canceled"]).default("active"),
  listingSignedAt: ymdSchema.optional(),
  acceptanceAt: ymdSchema.optional(),
  coeAt: ymdSchema.optional(),
  disclosureDeliveredAt: ymdSchema.optional(),
  flags: flagsSchema.default({}),
  templateKey: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export const patchTransactionSchema = z.object({
  address: z.string().min(1).max(300).optional(),
  contactId: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  stage: z.string().max(120).nullable().optional(),
  status: z.enum(["active", "pending", "closed", "canceled"]).optional(),
  closedAt: ymdOrNull.optional(),
  listingSignedAt: ymdOrNull.optional(),
  acceptanceAt: ymdOrNull.optional(),
  coeAt: ymdOrNull.optional(),
  disclosureDeliveredAt: ymdOrNull.optional(),
  flags: flagsSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const instantiateSchema = z.object({ templateKey: z.string().optional(), reset: z.boolean().default(false) });

export const patchItemSchema = z.object({
  status: itemStatusSchema.optional(),
  dueOverride: ymdOrNull.optional(),
  notes: z.string().max(2000).nullable().optional(),
  sourceDocumentId: z.string().nullable().optional(),
});

export const exportChecklistSchema = z.object({ format: z.enum(["xlsx", "pdf"]).default("pdf"), approvedBy: z.string().min(1).max(120).default("Avery Sandoval") });
