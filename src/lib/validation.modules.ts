import { z } from "zod";

/** Zod schemas for the extended-module API routes. */

// ── OM Quality Gate ──────────────────────────────────────────────────────────

export const templateRightsSchema = z.object({
  name: z.string().min(1).max(160),
  family: z.enum(["institutional", "luxury", "multifamily", "retail_office", "development"]),
  description: z.string().max(500).optional(),
  ownershipBasis: z.enum(["owned", "licensed", "original"]),
  confirmedBy: z.string().min(1).default("Avery Sandoval"),
  note: z.string().max(500).optional(),
});

export const brandProfileSchema = z.object({
  name: z.string().min(1).max(160),
  broker: z.string().max(200).optional(),
  contact: z.string().max(200).optional(),
  disclaimer: z.string().max(1000).optional(),
  colors: z.array(z.string().max(20)).max(8).default([]),
  typography: z.string().max(80).default("Archivo"),
});

export const createOmSchema = z.object({
  propertyId: z.string().optional(),
  name: z.string().min(1).max(200),
  address: z.string().max(200).optional(),
  market: z.string().max(160).optional(),
  assetType: z.string().max(120).optional(),
  price: z.string().max(60).optional(),
  brandProfileId: z.string().min(1, "A brand kit is required."),
  templateProfileId: z.string().min(1, "A template is required."),
});

export const omExportSchema = z.object({
  format: z.enum(["pptx", "pdf"]),
  approvedBy: z.string().min(1).default("Avery Sandoval"),
});

export const omApproveSchema = z.object({
  approvedBy: z.string().min(1).default("Avery Sandoval"),
  confirm: z.literal(true),
});

// ── Development Visualizer ───────────────────────────────────────────────────

export const VISUALIZATION_TYPES = [
  "site_boundary",
  "land_teaser",
  "massing",
  "future_use",
  "construction_sequence",
  "aerial_reel",
] as const;

export const createVisualizerProjectSchema = z.object({
  propertyId: z.string().optional(),
  name: z.string().min(1).max(200),
  address: z.string().max(200).optional(),
  visualizationType: z.enum(VISUALIZATION_TYPES),
});

export const addVisualizerSourceSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["aerial", "site_plan", "survey", "map", "geojson", "photo"]),
  label: z.string().max(200).optional(),
  rightsConfirmed: z.boolean().default(false),
  boundaryVerified: z.boolean().default(false),
  boundaryBasis: z.enum(["survey", "site_plan", "geojson", "manual", "none"]).default("none"),
});

export const storyboardSchema = z.object({
  projectId: z.string().min(1),
  format: z.enum(["9:16", "16:9", "square"]).default("16:9"),
  durationSec: z.union([z.literal(10), z.literal(15), z.literal(30), z.literal(45)]).default(15),
  visualDirection: z
    .enum(["architectural editorial", "modern urban", "warm lifestyle", "institutional investment", "custom"])
    .default("architectural editorial"),
  cameraMovement: z
    .enum(["static aerial", "slow push-in", "top-down descent", "orbit", "lateral glide"])
    .default("slow push-in"),
  boundaryStyle: z.enum(["none", "subtle", "glow"]).default("none"),
  textOverlays: z.record(z.string(), z.string()).default({}),
  disclosureMode: z.enum(["brokerage", "enhanced", "custom"]).default("brokerage"),
  disclosureText: z.string().max(1000).optional(),
  budgetCapUsd: z.number().nonnegative().max(100000).default(50),
});

export const createVizJobSchema = z.object({
  projectId: z.string().min(1),
  storyboardId: z.string().optional(),
  type: z.enum(["image", "video", "overlay"]).default("image"),
  remote: z.boolean().default(false),
});

export const vizApproveRemoteSchema = z.object({
  approvedForRemote: z.literal(true),
  approvedBy: z.string().min(1).default("Avery Sandoval"),
});

// ── Rent Roll Studio ─────────────────────────────────────────────────────────

export const rentRollImportSchema = z.object({
  name: z.string().min(1).max(200).default("Rent roll import"),
  propertyId: z.string().optional(),
  format: z.enum(["csv", "xlsx_json"]).default("csv"),
  content: z.string().min(1, "Provide CSV content."),
  mapping: z.record(z.string(), z.string()).optional(),
  localOnly: z.boolean().default(true),
  redactPii: z.boolean().default(false),
});

export const rentRollExportSchema = z.object({
  redactPii: z.boolean().default(false),
});

// ── Comp Lab ─────────────────────────────────────────────────────────────────

export const compImportSchema = z.object({
  name: z.string().min(1).max(200).default("Comp set"),
  propertyId: z.string().optional(),
  compType: z.enum(["sales", "lease", "active", "pending", "user"]).default("sales"),
  content: z.string().min(1, "Provide CSV content from an authorized source."),
  subject: z
    .object({ size: z.number().nullable().optional(), pricePerSf: z.number().nullable().optional(), assetType: z.string().nullable().optional() })
    .optional(),
  weights: z
    .object({
      distance: z.number().min(0).max(1),
      recency: z.number().min(0).max(1),
      sizeSimilarity: z.number().min(0).max(1),
      psfSimilarity: z.number().min(0).max(1),
      assetMatch: z.number().min(0).max(1),
    })
    .optional(),
});

export const compAdjustmentSchema = z.object({
  compId: z.string().min(1),
  label: z.string().min(1).max(160),
  amount: z.number().optional(),
  note: z.string().max(500).optional(),
});

export const compExportSchema = z.object({ format: z.enum(["xlsx", "pdf"]) });

// ── Signal Scout ─────────────────────────────────────────────────────────────

export const generateSignalsSchema = z.object({
  mlsExport: z.string().optional(), // CSV content of status export
  fromFub: z.boolean().default(true),
  staleThresholdDays: z.number().int().min(1).max(365).default(30),
});

export const signalActionSchema = z.object({
  action: z.enum(["pursue", "snooze", "dismiss", "create_task", "add_note", "draft_outreach"]),
  reason: z.string().max(500).optional(),
  snoozeDays: z.number().int().min(1).max(365).optional(),
  taskTitle: z.string().max(300).optional(),
  noteBody: z.string().max(2000).optional(),
});
