/**
 * Pure parsing helpers for listing facts. No inference: these only normalise
 * values that are explicitly present. A missing value returns null — AgentOS
 * never fabricates a listing fact.
 */

/** Parse a dollar amount from free text, e.g. "$700,000 (hard)" → 700000. */
export function parseCeiling(text: string | null | undefined): number | null {
  return parseMoney(text);
}

/** Parse the first dollar amount in a string. Returns null if none present. */
export function parseMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2]?.toLowerCase();
  if (unit === "k") n *= 1_000;
  if (unit === "m") n *= 1_000_000;
  return Math.round(n);
}

/** Parse a numeric measure (beds, baths, sqft) from text. Null if absent. */
export function parseNumber(text: string | null | undefined): number | null {
  if (text == null) return null;
  const s = String(text).replace(/,/g, "");
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** True when a hard-constraint phrase implies a required count, e.g. "3+ beds". */
export function parseMinCount(text: string): number | null {
  const m = text.match(/(\d+)\s*\+/);
  return m ? Number(m[1]) : parseNumber(text);
}
