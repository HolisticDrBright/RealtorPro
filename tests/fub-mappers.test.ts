import { describe, expect, it } from "vitest";
import { appointmentToLocal, dealToLocal, nextOffset, noteToLocal, personToContact, taskToLocal } from "../src/services/fub/mappers";

describe("FUB person → contact", () => {
  it("keys by FUB id and mirrors the visible fields", () => {
    const c = personToContact({ id: 42, name: "Priya Mehta", emails: [{ value: "p@example.com" }], phones: [{ value: "503-555-0100" }], stage: "Active Client", tags: ["Hot", "Buyer"], source: "Zillow", assignedTo: "Avery", lastActivity: "2026-08-30T10:00:00Z" });
    expect(c.fubId).toBe("42");
    expect(c.name).toBe("Priya Mehta");
    expect(c.email).toBe("p@example.com");
    expect(c.phone).toBe("503-555-0100");
    expect(c.role).toBe("Buyer");
    expect(c.temperature).toBe("hot");
    expect(c.tags).toEqual(["Hot", "Buyer"]);
  });

  it("falls back to first/last name, then the FUB id, and leaves temperature alone without a tag", () => {
    expect(personToContact({ id: 7, firstName: "Sam", lastName: "Ruiz" }).name).toBe("Sam Ruiz");
    const c = personToContact({ id: "9", name: "", firstName: null, lastName: null });
    expect(c.name).toBe("FUB #9");
    expect(c.temperature).toBeNull();
    expect(c.email).toBeNull();
  });

  it("derives role from stage and tags", () => {
    expect(personToContact({ id: 1, stage: "Past Client" }).role).toBe("Past client");
    expect(personToContact({ id: 2, tags: ["seller"] }).role).toBe("Seller");
  });
});

describe("FUB deal → local deal + transaction", () => {
  it("infers listing side from the pipeline and pending status from the stage", () => {
    const d = dealToLocal({ id: 5, name: "1204 NE Alameda", price: "$1,150,000", status: "Active", pipeline: { name: "Listings" }, stage: { name: "Under Contract" }, people: [{ id: 42 }] });
    expect(d.side).toBe("listing");
    expect(d.txStatus).toBe("pending");
    expect(d.price).toBe(1150000);
    expect(d.personFubId).toBe("42");
  });

  it("maps won → closed, lost → canceled, otherwise buyer/active", () => {
    expect(dealToLocal({ id: 1, status: "Won", pipeline: "Buyers" }).txStatus).toBe("closed");
    expect(dealToLocal({ id: 2, status: "Lost" }).txStatus).toBe("canceled");
    const d = dealToLocal({ id: 3, pipeline: "Buyers", stage: "Touring" });
    expect(d.side).toBe("buyer");
    expect(d.txStatus).toBe("active");
    expect(d.name).toBe("Deal 3");
    expect(d.price).toBeNull();
  });
});

describe("FUB tasks, notes, appointments", () => {
  it("maps tasks with completion status", () => {
    expect(taskToLocal({ id: 1, personId: 42, name: "Call lender", dueDate: "2026-09-03", isCompleted: true })).toEqual({ fubId: "1", personFubId: "42", title: "Call lender", body: null, dueAt: "2026-09-03", status: "done" });
    expect(taskToLocal({ id: 2 }).title).toBe("(untitled task)");
  });
  it("maps notes and appointments", () => {
    expect(noteToLocal({ id: 3, personId: 1, subject: "Showing", body: "Liked it", created: "2026-09-01" }).subject).toBe("Showing");
    const a = appointmentToLocal({ id: 4, title: "Inspection", start: "2026-09-04T16:00:00Z", end: "2026-09-04T17:00:00Z", type: { name: "Inspection" }, invitees: [{ personId: 42 }] });
    expect(a.personFubId).toBe("42");
    expect(a.type).toBe("Inspection");
    expect(a.endsAt).toBe("2026-09-04T17:00:00Z");
  });
});

describe("pagination", () => {
  it("advances by received count and stops on a short page or the total", () => {
    expect(nextOffset({ offset: 0, limit: 100, total: 250 }, 100)).toBe(100);
    expect(nextOffset({ offset: 200, limit: 100, total: 250 }, 50)).toBeNull();
    expect(nextOffset({ offset: 100, limit: 100, total: 200 }, 100)).toBeNull();
    expect(nextOffset(undefined, 0)).toBeNull();
  });
});
