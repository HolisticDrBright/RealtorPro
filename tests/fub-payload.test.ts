import { describe, it, expect } from "vitest";
import {
  buildTaskPayload,
  buildNotePayload,
  requireFubPersonId,
  FubLinkError,
  FORBIDDEN_FUB_ACTIONS,
} from "@/services/fub/payloads";

describe("FUB contact linking (never by name)", () => {
  it("requires a FUB person id — a name-only / unlinked contact is refused", () => {
    expect(() => requireFubPersonId(null)).toThrow(FubLinkError);
    expect(() => requireFubPersonId("")).toThrow(FubLinkError);
    expect(() => requireFubPersonId("Jordan Mehta")).toThrow(FubLinkError);
  });

  it("accepts a valid numeric FUB id", () => {
    expect(requireFubPersonId("48213")).toBe(48213);
  });
});

describe("buildTaskPayload", () => {
  it("builds a valid FUB Task payload tagged as AgentOS", () => {
    const p = buildTaskPayload({ fubContactId: "48213", title: "Show 4823 SE Reedway St", dueAt: "2026-07-22" });
    expect(p).toMatchObject({
      personId: 48213,
      type: "Task",
      name: "Show 4823 SE Reedway St",
      dueDate: "2026-07-22",
      isCompleted: false,
      source: "AgentOS",
    });
  });

  it("throws without a FUB link (prevents name-based writes)", () => {
    expect(() => buildTaskPayload({ fubContactId: null, title: "x" })).toThrow(FubLinkError);
  });

  it("requires a title", () => {
    expect(() => buildTaskPayload({ fubContactId: "1", title: "  " })).toThrow(FubLinkError);
  });
});

describe("buildNotePayload", () => {
  it("builds a DRAFT note payload (never sent)", () => {
    const p = buildNotePayload({ fubContactId: "47990", body: "Lender confirmed appraisal ordered." });
    expect(p.personId).toBe(47990);
    expect(p.isDraft).toBe(true);
    expect(p.source).toBe("AgentOS");
    expect(p.body).toMatch(/appraisal/);
  });

  it("requires a body", () => {
    expect(() => buildNotePayload({ fubContactId: "1", body: "" })).toThrow(FubLinkError);
  });
});

describe("write surface is limited to tasks + draft notes", () => {
  it("has no builder for any forbidden action (send/lead/delete/edit)", () => {
    // The module exports only task + note builders; forbidden actions are
    // enumerated for documentation and must never gain a builder.
    expect(FORBIDDEN_FUB_ACTIONS).toContain("sendEmail");
    expect(FORBIDDEN_FUB_ACTIONS).toContain("createLead");
    expect(FORBIDDEN_FUB_ACTIONS).toContain("sendText");
    const mod = { buildTaskPayload, buildNotePayload } as Record<string, unknown>;
    for (const action of FORBIDDEN_FUB_ACTIONS) {
      expect(mod[action]).toBeUndefined();
    }
  });
});
