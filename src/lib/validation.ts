import { z } from "zod";

/**
 * Zod schemas for API inputs. Every route validates its body/query with one of
 * these and returns a structured `validation_error` on failure.
 */

export const columnMappingSchema = z.record(
  z.string(),
  z.string().min(1),
);

export const csvImportSchema = z.object({
  filename: z.string().min(1).max(200).optional(),
  csv: z.string().min(1, "CSV content is required."),
  mappingId: z.string().optional(),
  mapping: columnMappingSchema.optional(),
  saveMappingName: z.string().min(1).max(120).optional(),
  propertyId: z.string().optional(),
});

export const saveMappingSchema = z.object({
  name: z.string().min(1).max(120),
  sourceType: z.string().default("mls_csv"),
  mapping: columnMappingSchema,
});

export const mediaUploadMetaSchema = z.object({
  propertyId: z.string().min(1),
  kind: z.enum(["image", "floorplan", "video"]),
  label: z.string().max(200).optional(),
  rightsConfirmed: z.coerce.boolean(),
  alterationStatus: z.enum(["original", "altered"]).default("original"),
  originalAssetId: z.string().optional(),
  alterationDescription: z.string().max(500).optional(),
});

export const weightedPrefSchema = z.object({
  label: z.string().min(1),
  weight: z.number().int().min(0).max(100),
});

export const buyerCriteriaSchema = z.object({
  contactId: z.string().optional(),
  label: z.string().max(200).optional(),
  ceilingText: z.string().max(200).optional(),
  ceilingAmount: z.number().int().nonnegative().nullable().optional(),
  ceilingHard: z.boolean().default(true),
  hardConstraints: z.array(z.string().max(200)).default([]),
  weightedPrefs: z.array(weightedPrefSchema).default([]),
  areas: z.array(z.string().max(120)).default([]),
  mustHaves: z.array(z.string().max(200)).default([]),
  agreedAt: z.string().optional(),
});

export const scoutParseSchema = z.object({
  criteriaProfileId: z.string().min(1),
  source: z.enum(["csv", "pdf", "email"]).default("email"),
  content: z.string().min(1, "Paste the alert text or CSV content."),
  filename: z.string().max(200).optional(),
});

export const shortlistItemSchema = z.object({
  shortlistId: z.string().optional(),
  criteriaProfileId: z.string().min(1),
  matchId: z.string().optional(),
  propertyId: z.string().optional(),
});

export const creativeSettingsSchema = z.object({
  brandVoice: z.string().max(200).default("Warm, concrete, no hype"),
  campaignGoal: z.string().max(200).optional(),
  styleEmphasis: z.string().max(200).optional(),
  visualTreatment: z.string().max(200).optional(),
  roomFocus: z.string().max(200).optional(),
  videoFormat: z.string().max(200).optional(),
  cameraMood: z.string().max(200).optional(),
  creativeDirection: z.string().max(2000).optional(),
  disclosureMode: z.enum(["always_disclose", "no_alteration"]).default("always_disclose"),
  spendCapUsd: z.number().nonnegative().max(100000).default(1200),
});

export const createJobSchema = z.object({
  propertyId: z.string().min(1),
  type: z.enum(["campaign", "mls_description", "image", "video"]).default("campaign"),
  settings: creativeSettingsSchema,
  remote: z.boolean().default(false),
});

export const approveJobRemoteSchema = z.object({
  approvedForRemote: z.literal(true),
  approvedBy: z.string().min(1),
});

export const approvalSchema = z.object({
  targetType: z.enum(["draft", "section", "disclosure", "remote_generation", "shortlist"]),
  targetId: z.string().min(1),
  label: z.string().max(200).optional(),
  approvedBy: z.string().min(1).default("Avery Sandoval"),
  note: z.string().max(500).optional(),
});

export const fubTaskSchema = z.object({
  contactId: z.string().min(1),
  fubId: z.string().optional(),
  title: z.string().min(1).max(300),
  body: z.string().max(2000).optional(),
  dueAt: z.string().optional(),
});

export const fubNoteSchema = z.object({
  contactId: z.string().min(1),
  fubId: z.string().optional(),
  body: z.string().min(1).max(5000),
});

export const fubConnectSchema = z.object({
  apiKey: z.string().min(8, "Enter your Follow Up Boss API key.").optional(),
  action: z.enum(["connect", "disconnect", "pause"]).default("connect"),
});

export type CsvImportInput = z.infer<typeof csvImportSchema>;
export type BuyerCriteriaInput = z.infer<typeof buyerCriteriaSchema>;
export type CreativeSettings = z.infer<typeof creativeSettingsSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
