/**
 * Fair Housing guardrails.
 *
 * AgentOS refuses to target or rank on protected classes, and refuses subjective
 * "neighborhood vibe" / demographic ranking requests. Buyer matching is allowed
 * ONLY on objective listing facts against agreed criteria.
 *
 * This is intentionally conservative: it flags language that steers on a
 * protected characteristic (federal Fair Housing Act classes plus common
 * proxies). It is pure and unit-tested.
 */

export type FairHousingCategory =
  | "protected_class"
  | "familial_status"
  | "disability"
  | "religion"
  | "national_origin"
  | "race_ethnicity"
  | "sex_gender"
  | "steering"
  | "subjective_neighborhood";

export interface FairHousingViolation {
  category: FairHousingCategory;
  phrase: string;
  message: string;
}

interface Rule {
  category: FairHousingCategory;
  /** Matched as a whole-word / phrase, case-insensitive. */
  patterns: RegExp[];
  message: string;
}

const RULES: Rule[] = [
  {
    category: "race_ethnicity",
    patterns: [
      /\b(white|black|caucasian|hispanic|latino|latina|asian|arab|jewish neighborhood|african[- ]american)\b/i,
      /\b(no|only|prefer(?:ably)?)\s+\w*\s*(black|white|asian|hispanic|latino)\b/i,
    ],
    message: "Targeting or ranking by race or ethnicity is prohibited under the Fair Housing Act.",
  },
  {
    category: "religion",
    patterns: [
      /\b(christian|catholic|muslim|jewish|hindu|buddhist)\s+(family|families|buyers?|neighborhood|community|only)\b/i,
      /\bnear (a )?(church|mosque|temple|synagogue)\b.*\b(for|so|because)\b/i,
      /\b(good|strong)\s+(christian|church)\s+(community|values)\b/i,
    ],
    message: "Targeting or ranking by religion is prohibited under the Fair Housing Act.",
  },
  {
    category: "national_origin",
    patterns: [/\b(no immigrants|american[- ]born only|english speakers only|no foreigners)\b/i],
    message: "Targeting or ranking by national origin is prohibited under the Fair Housing Act.",
  },
  {
    category: "familial_status",
    patterns: [
      /\b(no kids|no children|childless|adults? only|no families|singles only|empty[- ]nesters? only|mature (?:adults?|community) only)\b/i,
      /\b(perfect|ideal|great)\s+for\s+(young )?(families|couples|singles)\b/i,
    ],
    message: "Targeting or ranking by familial status (presence of children) is prohibited.",
  },
  {
    category: "disability",
    patterns: [
      /\b(no wheelchairs?|able[- ]bodied|no disabilities|healthy (?:buyers?|tenants?) only)\b/i,
      /\bnot suitable for (the )?(disabled|handicapped)\b/i,
    ],
    message: "Targeting or ranking by disability is prohibited under the Fair Housing Act.",
  },
  {
    category: "sex_gender",
    patterns: [/\b(male only|female only|men only|women only|no (?:men|women)|bachelor pad for)\b/i],
    message: "Targeting or ranking by sex or gender is prohibited under the Fair Housing Act.",
  },
  {
    category: "steering",
    patterns: [
      /\b(good|great|bad|better|nicer)\s+schools?\b/i,
      /\b(family[- ]friendly|safe(?:r)? (?:neighborhood|area|part of town)|good (?:area|part of town)|desirable neighborhood|right kind of (?:people|neighbors))\b/i,
      /\b(sketchy|rough|bad) (?:area|neighborhood|part of town)\b/i,
    ],
    message:
      "Ranking on subjective safety / school / 'good area' judgments can steer on protected classes and is not allowed. Use objective listing facts instead.",
  },
  {
    category: "subjective_neighborhood",
    patterns: [
      /\b(up[- ]and[- ]coming|prestigious|exclusive|classy|trendy|hip|the vibe|neighborhood vibe|character of the (?:neighborhood|community)|type of people|kind of neighborhood)\b/i,
      /\b(demographics?|median (?:age|income) of (?:residents|neighbors)|who lives (?:there|nearby))\b/i,
    ],
    message:
      "Subjective neighborhood-vibe or demographic ranking is not supported. AgentOS scores only on objective listing facts.",
  },
];

/** Scan free text for Fair Housing violations. */
export function checkText(text: string | null | undefined): FairHousingViolation[] {
  if (!text) return [];
  const violations: FairHousingViolation[] = [];
  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      const m = text.match(pat);
      if (m) {
        violations.push({ category: rule.category, phrase: m[0].trim(), message: rule.message });
        break; // one hit per rule is enough
      }
    }
  }
  return violations;
}

/** Scan a set of strings (criteria fields) and dedupe by category+phrase. */
export function checkStrings(strings: (string | null | undefined)[]): FairHousingViolation[] {
  const all = strings.flatMap((s) => checkText(s));
  const seen = new Set<string>();
  return all.filter((v) => {
    const key = `${v.category}:${v.phrase.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface CriteriaLike {
  ceilingText?: string | null;
  hardConstraints?: string[] | null;
  weightedPrefs?: { label: string }[] | null;
  areas?: string[] | null;
  mustHaves?: string[] | null;
  freeform?: string | null;
}

/** Assess a whole buyer-criteria object. */
export function checkCriteria(criteria: CriteriaLike): FairHousingViolation[] {
  const strings: (string | null | undefined)[] = [
    criteria.ceilingText,
    criteria.freeform,
    ...(criteria.hardConstraints ?? []),
    ...(criteria.weightedPrefs ?? []).map((p) => p.label),
    ...(criteria.mustHaves ?? []),
  ];
  // Note: `areas` are treated as objective, client-drawn geographic boundaries
  // (subdivision / MLS area names), NOT subjective judgments — but we still scan
  // them for explicit protected-class language.
  strings.push(...(criteria.areas ?? []));
  return checkStrings(strings);
}

export interface FairHousingResult {
  allowed: boolean;
  violations: FairHousingViolation[];
}

export function assessCriteria(criteria: CriteriaLike): FairHousingResult {
  const violations = checkCriteria(criteria);
  return { allowed: violations.length === 0, violations };
}

export function assessText(text: string): FairHousingResult {
  const violations = checkText(text);
  return { allowed: violations.length === 0, violations };
}
