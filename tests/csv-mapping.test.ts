import { describe, it, expect } from "vitest";
import {
  parseCsv,
  detectMapping,
  importMlsCsv,
} from "@/lib/csv-mapping";

describe("parseCsv", () => {
  it("parses headers and rows, honoring quotes and embedded commas", () => {
    const csv = 'Address,List Price,Public Remarks\n"123 Main St, Apt 4","$500,000","Cozy, updated"';
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Address", "List Price", "Public Remarks"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Address"]).toBe("123 Main St, Apt 4");
    expect(rows[0]["List Price"]).toBe("$500,000");
    expect(rows[0]["Public Remarks"]).toBe("Cozy, updated");
  });

  it("handles escaped quotes and blank lines", () => {
    const csv = 'Address,Remarks\n1 A St,"He said ""hi"""\n\n2 B St,plain';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Remarks"]).toBe('He said "hi"');
    expect(rows[1]["Address"]).toBe("2 B St");
  });

  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("detectMapping", () => {
  it("maps common RMLS-style headers to canonical fields via aliases", () => {
    const { mapping, unmatched } = detectMapping([
      "Address",
      "ML#",
      "List Price",
      "Beds",
      "Baths",
      "SqFt",
      "Public Remarks",
    ]);
    expect(mapping.address).toBe("Address");
    expect(mapping.mlsNumber).toBe("ML#");
    expect(mapping.price).toBe("List Price");
    expect(mapping.beds).toBe("Beds");
    expect(mapping.sqft).toBe("SqFt");
    expect(mapping.remarks).toBe("Public Remarks");
    expect(unmatched).toContain("lot");
  });

  it("prefers a saved mapping when its headers are present", () => {
    const headers = ["Street", "Price"];
    const saved = { address: "Street" };
    const { mapping } = detectMapping(headers, saved);
    expect(mapping.address).toBe("Street"); // saved override (no alias for "Street")
    expect(mapping.price).toBe("Price"); // still auto-detected
  });

  it("does not map unknown headers (no fuzzy guessing)", () => {
    const { mapping } = detectMapping(["Whatever", "RandomCol"]);
    expect(Object.keys(mapping)).toHaveLength(0);
  });
});

describe("importMlsCsv", () => {
  it("reports rows missing a required fact as issues and never infers a value", () => {
    const csv = "Address,List Price,Beds\n100 Oak St,\"$400,000\",3\n200 Elm St,,2";
    const result = importMlsCsv(csv);
    expect(result.rowCount).toBe(2);
    expect(result.validRows).toBe(1);
    expect(result.status).toBe("partial");
    // The row with no price is missing `price` — value stays absent, not guessed.
    const bad = result.listings[1];
    expect(bad.missing).toContain("price");
    expect(bad.fields.price).toBeUndefined();
    expect(result.issues.join(" ")).toMatch(/missing a required value/i);
  });

  it("marks the import invalid when no column maps to a required field", () => {
    const csv = "Beds,Baths\n3,2";
    const result = importMlsCsv(csv);
    expect(result.status).toBe("invalid");
    expect(result.issues.join(" ")).toMatch(/No column maps to required field/i);
  });

  it("carries unmapped headers into per-row source metadata", () => {
    const csv = "Address,List Price,CountyId\n1 A St,\"$1\",XYZ";
    const result = importMlsCsv(csv);
    expect(result.detection.extraHeaders).toContain("CountyId");
    expect(result.listings[0].sourceMeta["CountyId"]).toBe("XYZ");
  });

  it("succeeds fully when all required fields are present", () => {
    const csv = "Address,List Price\n1 A St,\"$1\"\n2 B St,\"$2\"";
    const result = importMlsCsv(csv);
    expect(result.status).toBe("parsed");
    expect(result.validRows).toBe(2);
  });
});
