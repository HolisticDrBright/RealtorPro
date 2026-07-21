/**
 * Follow Up Boss payload builders and contact-linking rules.
 *
 * Pure and unit-tested. Two hard rules encoded here:
 *   1. AgentOS only ever creates TASKS and DRAFT NOTES — never messages, emails,
 *      or leads. There is no builder for a send/lead action.
 *   2. Contacts are linked to FUB by ID, NEVER matched by name alone.
 */

export interface FubTaskInput {
  fubContactId: string | null;
  title: string;
  body?: string;
  dueAt?: string;
  assignedTo?: string;
}

export interface FubTaskPayload {
  personId: number;
  type: "Task";
  name: string;
  description?: string;
  dueDate?: string;
  isCompleted: false;
  // Provenance marker so writes are identifiable in FUB.
  source: "AgentOS";
}

export interface FubNoteInput {
  fubContactId: string | null;
  body: string;
  subject?: string;
}

export interface FubNotePayload {
  personId: number;
  subject: string;
  body: string;
  // AgentOS notes are drafts for the agent to review/send from FUB.
  isDraft: true;
  source: "AgentOS";
}

export class FubLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FubLinkError";
  }
}

/**
 * Resolve the FUB person id for a write. Requires an explicit FUB id — a local
 * contact with no FUB link cannot be written to (prevents name-based matching).
 */
export function requireFubPersonId(fubContactId: string | null | undefined): number {
  if (!fubContactId || `${fubContactId}`.trim() === "") {
    throw new FubLinkError(
      "This contact is not linked to a Follow Up Boss record. Link it by FUB ID first — AgentOS never matches contacts by name.",
    );
  }
  const n = Number(fubContactId);
  if (!Number.isInteger(n) || n <= 0) {
    throw new FubLinkError(`"${fubContactId}" is not a valid Follow Up Boss person id.`);
  }
  return n;
}

export function buildTaskPayload(input: FubTaskInput): FubTaskPayload {
  const personId = requireFubPersonId(input.fubContactId);
  if (!input.title || input.title.trim() === "") {
    throw new FubLinkError("A task title is required.");
  }
  return {
    personId,
    type: "Task",
    name: input.title.trim(),
    description: input.body?.trim() || undefined,
    dueDate: input.dueAt || undefined,
    isCompleted: false,
    source: "AgentOS",
  };
}

export function buildNotePayload(input: FubNoteInput): FubNotePayload {
  const personId = requireFubPersonId(input.fubContactId);
  if (!input.body || input.body.trim() === "") {
    throw new FubLinkError("A note body is required.");
  }
  return {
    personId,
    subject: input.subject?.trim() || "AgentOS draft note",
    body: input.body.trim(),
    isDraft: true,
    source: "AgentOS",
  };
}

/**
 * Actions AgentOS will NEVER perform. Exported so tests can assert the surface
 * area stays limited to tasks + draft notes.
 */
export const FORBIDDEN_FUB_ACTIONS = [
  "sendText",
  "sendEmail",
  "createLead",
  "call",
  "deleteContact",
  "editContact",
] as const;
