/**
 * Scan for UNAPPROVED external brokerage branding.
 *
 * This flags well-known third-party brokerage names/marks for HUMAN REVIEW so a
 * user does not accidentally imitate or claim affiliation with another firm.
 * It is deliberately NOT a "remove competitor branding" tool — it only surfaces
 * matches for a person to resolve. Pure and unit-tested.
 */

export interface BrandingMatch {
  brand: string;
  phrase: string;
  message: string;
}

// Well-known commercial brokerages / marks. Matching a name only FLAGS it.
const KNOWN_BROKERAGES = [
  "JLL",
  "Jones Lang LaSalle",
  "CBRE",
  "Cushman & Wakefield",
  "Cushman and Wakefield",
  "Colliers",
  "Marcus & Millichap",
  "Marcus and Millichap",
  "Newmark",
  "Savills",
  "Avison Young",
  "Kidder Mathews",
  "Lee & Associates",
  "Berkadia",
  "Eastdil",
];

function wordBoundaryRegex(name: string): RegExp {
  // Escape regex specials; allow &/and and spacing variance is handled by the list.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])(${escaped})([^A-Za-z0-9]|$)`, "i");
}

/**
 * Scan free text (OM copy, template names, footer strings) for external
 * brokerage branding. `approvedBrands` are the user's own brand names to ignore.
 */
export function scanForExternalBranding(text: string | null | undefined, approvedBrands: string[] = []): BrandingMatch[] {
  if (!text) return [];
  const approved = new Set(approvedBrands.map((b) => b.toLowerCase()));
  const matches: BrandingMatch[] = [];
  for (const brand of KNOWN_BROKERAGES) {
    if (approved.has(brand.toLowerCase())) continue;
    const m = text.match(wordBoundaryRegex(brand));
    if (m) {
      matches.push({
        brand,
        phrase: m[2],
        message: `Possible unapproved external brokerage branding ("${m[2]}") — flag for human review. AgentOS does not remove third-party branding automatically; a person must confirm you are licensed to use it or remove it.`,
      });
    }
  }
  return matches;
}

/** Scan several strings and dedupe by brand. */
export function scanStringsForBranding(strings: (string | null | undefined)[], approvedBrands: string[] = []): BrandingMatch[] {
  const all = strings.flatMap((s) => scanForExternalBranding(s, approvedBrands));
  const seen = new Set<string>();
  return all.filter((m) => {
    if (seen.has(m.brand)) return false;
    seen.add(m.brand);
    return true;
  });
}
