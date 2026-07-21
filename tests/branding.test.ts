import { describe, it, expect } from "vitest";
import { scanForExternalBranding, scanStringsForBranding } from "@/lib/branding-scan";

describe("unapproved external branding scan (flags for human review, never removes)", () => {
  it("flags a known external brokerage name", () => {
    const matches = scanForExternalBranding("Prepared in the style of a CBRE offering memorandum.");
    expect(matches.length).toBe(1);
    expect(matches[0].brand).toBe("CBRE");
    expect(matches[0].message).toMatch(/human review/i);
    // It only flags — it never offers to remove competitor branding.
    expect(matches[0].message).not.toMatch(/removed automatically/i);
  });

  it("does not flag the user's own approved brand", () => {
    expect(scanForExternalBranding("PDX Homes — Commercial", ["PDX Homes — Commercial"])).toHaveLength(0);
  });

  it("does not false-positive on ordinary words", () => {
    expect(scanForExternalBranding("The building has a nice lobby and secure parking.")).toHaveLength(0);
  });

  it("dedupes across multiple strings", () => {
    const matches = scanStringsForBranding(["JLL logo here", "footer: JLL", "Newmark reference"]);
    const brands = matches.map((m) => m.brand);
    expect(brands).toContain("JLL");
    expect(brands).toContain("Newmark");
    expect(brands.filter((b) => b === "JLL")).toHaveLength(1);
  });
});
