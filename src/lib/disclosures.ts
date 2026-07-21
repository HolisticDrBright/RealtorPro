/**
 * Required-disclosure text and enforcement.
 *
 * Concept visualizations and future-development visuals MUST carry a disclosure;
 * construction-sequence videos MUST carry the construction label. All disclosure
 * text is user-editable, but the requirement itself cannot be removed. Pure.
 */

export type DisclosureKind =
  | "visualization"
  | "construction"
  | "boundary"
  | "om_legal"
  | "market_attribution";

export type DisclosureMode = "brokerage" | "enhanced" | "custom";

export const DEFAULT_DISCLOSURES: Record<Exclude<DisclosureKind, "custom">, string> = {
  visualization:
    "Conceptual visualization only. Not a survey, site plan, construction schedule, or representation of actual property condition.",
  construction:
    "Conceptual construction visualization — not actual construction progress.",
  boundary:
    "Boundary shown is a conceptual overlay derived from the cited source and is not a survey or legal boundary determination.",
  om_legal:
    "Information herein was obtained from sources deemed reliable but is not guaranteed. Recipients must independently verify all facts. This is not an offer to sell.",
  market_attribution:
    "Market statistics are attributed to their cited source. Figures without a named source are marked [TBD — source required] and are not represented as fact.",
};

/** Visualization types that REQUIRE a disclosure before generation/export. */
const VISUALIZATION_TYPES_REQUIRING_DISCLOSURE = new Set([
  "site_boundary",
  "land_teaser",
  "massing",
  "future_use",
  "construction_sequence",
  "aerial_reel",
]);

export function disclosureKindForVisualization(visualizationType: string): DisclosureKind {
  if (visualizationType === "construction_sequence") return "construction";
  if (visualizationType === "site_boundary") return "boundary";
  return "visualization";
}

export function requiresDisclosure(visualizationType: string): boolean {
  return VISUALIZATION_TYPES_REQUIRING_DISCLOSURE.has(visualizationType);
}

export interface DisclosureRequirement {
  kind: DisclosureKind;
  text: string;
  required: boolean;
  editable: boolean;
}

/** Build the disclosure requirement for a visualization type + mode. */
export function buildVisualizationDisclosure(
  visualizationType: string,
  mode: DisclosureMode = "brokerage",
  customText?: string,
): DisclosureRequirement {
  const kind = disclosureKindForVisualization(visualizationType);
  let text = DEFAULT_DISCLOSURES[kind as Exclude<DisclosureKind, "custom">] ?? "";
  if (mode === "enhanced") {
    text = `${text} All imagery is illustrative and may include AI-generated or AI-altered elements.`;
  }
  if (mode === "custom" && customText) text = customText;
  return { kind, text, required: requiresDisclosure(visualizationType), editable: true };
}

/**
 * Enforce that a required disclosure is present and approved before export.
 * Returns the blocking reason, or null when clear.
 */
export function enforceDisclosure(input: {
  visualizationType: string;
  disclosureText?: string | null;
  approved?: boolean;
}): string | null {
  if (!requiresDisclosure(input.visualizationType)) return null;
  if (!input.disclosureText || input.disclosureText.trim() === "") {
    return "A required disclosure is missing for this visualization type.";
  }
  if (!input.approved) {
    return "The required disclosure must be approved before export.";
  }
  return null;
}

/** The literal marker used everywhere a fact is unavailable. */
export const TBD = "[TBD — source required]";
