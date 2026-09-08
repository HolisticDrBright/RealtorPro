import { z } from "zod";

export const INVESTOR_STRATEGIES = ["buy_and_hold", "fix_and_flip", "brrrr", "short_term_rental", "development", "commercial", "other"] as const;
export const INVESTOR_STATUSES = ["active", "nurture", "paused"] as const;
const text = z.string().trim().max(2000).nullish();
const list = z.union([z.array(z.string().trim().max(200)), z.string().transform((v) => v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))]).optional();
// Do not silently turn invalid text or negatives into positive money.
const amount = (max: number) => z.preprocess((v) => {
  if (typeof v !== "string") return v;
  if (!v.trim()) return null;
  const match = v.trim().replace(/[$,\s]/g, "").match(/^(-?\d+(?:\.\d+)?)([km])?$/i);
  return match ? Number(match[1]) * (match[2]?.toLowerCase() === "m" ? 1e6 : match[2]?.toLowerCase() === "k" ? 1e3 : 1) : NaN;
}, z.number().finite().min(0).max(max).nullish());

export const investorProfileSchema = z.object({
  strategy: z.enum(INVESTOR_STRATEGIES).nullish().transform((v) => v ?? undefined),
  status: z.enum(INVESTOR_STATUSES).nullish().transform((v) => v ?? undefined),
  targetAreas: list, propertyTypes: list,
  budgetMin: amount(1e12), budgetMax: amount(1e12), availableCapital: amount(1e12),
  targetCapRate: amount(100), targetCashOnCash: amount(100),
  financingType: text, timeline: text, mustHaves: list, dealBreakers: list, notes: text,
});

/** Validate the full row, including on PATCH, inside the caller's transaction. */
export function validateInvestorBudget(row: { budgetMin?: unknown; budgetMax?: unknown }) {
  if (typeof row.budgetMin === "number" && typeof row.budgetMax === "number" && row.budgetMin > row.budgetMax) {
    throw new z.ZodError([{ code: "custom", path: ["budgetMax"], message: "Maximum budget must be at least the minimum budget." }]);
  }
}

export interface Investor {
  id: string; contactId: string; strategy: string; status: string;
  targetAreas: string[] | null; propertyTypes: string[] | null;
  budgetMin: number | null; budgetMax: number | null; availableCapital: number | null;
  targetCapRate: number | null; targetCashOnCash: number | null;
  financingType: string | null; timeline: string | null;
  mustHaves: string[] | null; dealBreakers: string[] | null; notes: string | null;
}
