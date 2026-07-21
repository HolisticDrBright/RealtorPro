/**
 * Boundary-source requirement for the Development Visualizer.
 *
 * A glowing/precise site-boundary overlay may be generated ONLY when a verified
 * boundary source exists: an uploaded survey, site plan, approved GIS/GeoJSON,
 * or a manual confirmation of an exact boundary source. If none exists, the
 * overlay is prohibited and the caller must show a clear explanation. Pure.
 */

export type BoundaryBasis = "survey" | "site_plan" | "geojson" | "manual" | "none";
export type BoundaryStyle = "none" | "subtle" | "glow";

export interface BoundarySourceLike {
  boundaryVerified?: boolean;
  boundaryBasis?: string | null;
}

const VERIFIED_BASES = new Set<BoundaryBasis>(["survey", "site_plan", "geojson", "manual"]);

/** True when at least one source verifies an exact boundary. */
export function hasVerifiedBoundary(sources: BoundarySourceLike[]): boolean {
  return sources.some(
    (s) => s.boundaryVerified === true && VERIFIED_BASES.has((s.boundaryBasis ?? "none") as BoundaryBasis),
  );
}

export interface BoundaryDecision {
  allowed: boolean;
  /** The strongest boundary style the sources permit. */
  maxStyle: BoundaryStyle;
  reason: string | null;
  basis: BoundaryBasis | null;
}

/**
 * Decide whether a requested boundary style is permitted given the sources.
 * `none` is always allowed. `subtle`/`glow` require a verified boundary source.
 */
export function decideBoundary(sources: BoundarySourceLike[], requestedStyle: BoundaryStyle): BoundaryDecision {
  if (requestedStyle === "none") {
    return { allowed: true, maxStyle: "none", reason: null, basis: null };
  }
  const verified = sources.find(
    (s) => s.boundaryVerified === true && VERIFIED_BASES.has((s.boundaryBasis ?? "none") as BoundaryBasis),
  );
  if (!verified) {
    return {
      allowed: false,
      maxStyle: "none",
      reason:
        "A boundary overlay requires a verified boundary source — upload a survey, site plan, or approved GIS/GeoJSON, or manually confirm an exact boundary source. Until then, only the 'none' boundary style is available.",
      basis: null,
    };
  }
  return { allowed: true, maxStyle: requestedStyle, reason: null, basis: (verified.boundaryBasis ?? "manual") as BoundaryBasis };
}
