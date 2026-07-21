import { describe, it, expect } from "vitest";
import {
  remoteNeedsApproval,
  assertApprovedForRun,
  sectionApproved,
  allSectionsApproved,
  ApprovalRequiredError,
} from "@/lib/gates";

describe("remote generation approval gate", () => {
  it("requires approval for a remote job that is not yet approved", () => {
    expect(remoteNeedsApproval({ isRemote: true, approvedForRemote: false })).toBe(true);
  });

  it("allows a remote job once approved", () => {
    expect(remoteNeedsApproval({ isRemote: true, approvedForRemote: true })).toBe(false);
  });

  it("never gates a local (mock) job", () => {
    expect(remoteNeedsApproval({ isRemote: false, approvedForRemote: false })).toBe(false);
  });

  it("assertApprovedForRun throws only for unapproved remote jobs", () => {
    expect(() => assertApprovedForRun({ isRemote: true, approvedForRemote: false })).toThrow(
      ApprovalRequiredError,
    );
    expect(() => assertApprovedForRun({ isRemote: true, approvedForRemote: true })).not.toThrow();
    expect(() => assertApprovedForRun({ isRemote: false, approvedForRemote: false })).not.toThrow();
  });
});

describe("campaign section approval gate", () => {
  const required = ["mls", "social", "flyer", "video"];

  it("reports a single section's approval state", () => {
    expect(sectionApproved({ mls: true }, "mls")).toBe(true);
    expect(sectionApproved({ mls: true }, "social")).toBe(false);
  });

  it("is not complete until every required section is approved", () => {
    expect(allSectionsApproved({ mls: true, social: true }, required)).toBe(false);
    expect(
      allSectionsApproved({ mls: true, social: true, flyer: true, video: true }, required),
    ).toBe(true);
  });
});
