/**
 * Pure approval-gate logic. Kept dependency-free so the gates are unit-tested in
 * isolation. These encode two rules:
 *   1. A remote (paid) generation job must be explicitly approved before it runs.
 *   2. A campaign is only "done" when every required section is approved.
 */

export class ApprovalRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

export interface RemoteJobState {
  isRemote: boolean;
  approvedForRemote: boolean;
}

/** True when a job would contact a remote provider but has no approval yet. */
export function remoteNeedsApproval(job: RemoteJobState): boolean {
  return job.isRemote && !job.approvedForRemote;
}

/** Throw unless the job is cleared to run (local jobs always are). */
export function assertApprovedForRun(job: RemoteJobState): void {
  if (remoteNeedsApproval(job)) {
    throw new ApprovalRequiredError(
      "This job runs on a remote provider and needs explicit approval before generation.",
    );
  }
}

/** Whether a specific campaign section has an approval on record. */
export function sectionApproved(approvals: Record<string, boolean>, key: string): boolean {
  return approvals[key] === true;
}

/** Whether every required section is approved (campaign ready to publish). */
export function allSectionsApproved(
  approvals: Record<string, boolean>,
  requiredKeys: string[],
): boolean {
  return requiredKeys.every((k) => sectionApproved(approvals, k));
}
