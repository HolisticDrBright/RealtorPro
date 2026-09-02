/**
 * Pure mappers from Follow Up Boss API shapes to AgentOS records. Unit-tested.
 * Fields are optional/defensive because FUB payloads vary by account; nothing
 * is invented — a missing value stays null. Contacts are keyed by FUB id.
 */

export interface FubPerson {
  id: number | string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  emails?: { value?: string | null }[] | null;
  phones?: { value?: string | null }[] | null;
  stage?: string | null;
  tags?: string[] | null;
  source?: string | null;
  assignedTo?: string | null;
  lastActivity?: string | null;
}
export interface FubTask {
  id: number | string;
  personId?: number | string | null;
  name?: string | null;
  type?: string | null;
  dueDate?: string | null;
  isCompleted?: boolean | null;
}
export interface FubNote {
  id: number | string;
  personId?: number | string | null;
  subject?: string | null;
  body?: string | null;
  created?: string | null;
}
export interface FubDeal {
  id: number | string;
  name?: string | null;
  price?: number | string | null;
  status?: string | null;
  stage?: { name?: string | null } | string | null;
  pipeline?: { name?: string | null } | string | null;
  pipelineName?: string | null;
  closeDate?: string | null;
  people?: { id?: number | string | null }[] | null;
  personId?: number | string | null;
}
export interface FubAppointment {
  id: number | string;
  title?: string | null;
  description?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  type?: string | { name?: string } | null;
  invitees?: { personId?: number | string | null }[] | null;
}

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const nameOf = (v: { name?: string | null } | string | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : str(v.name);

export function personToContact(p: FubPerson) {
  const name = str(p.name) ?? ([p.firstName, p.lastName].filter(Boolean).join(" ").trim() || `FUB #${p.id}`);
  const tags = (p.tags ?? []).filter((t): t is string => typeof t === "string");
  const lower = tags.map((t) => t.toLowerCase());
  const stage = str(p.stage);
  const role = lower.includes("seller")
    ? "Seller"
    : /past|closed|sold/i.test(stage ?? "") || lower.includes("past client")
      ? "Past client"
      : "Buyer";
  const temperature = lower.includes("hot") ? "hot" : lower.includes("cold") ? "cold" : lower.includes("warm") ? "warm" : null;
  return {
    fubId: String(p.id),
    name,
    role,
    stage,
    phone: str(p.phones?.[0]?.value),
    email: str(p.emails?.[0]?.value),
    tags,
    source: str(p.source),
    assignedTo: str(p.assignedTo),
    lastActivityAt: str(p.lastActivity),
    temperature, // null → keep the locally set value
  };
}

export function taskToLocal(t: FubTask) {
  return {
    fubId: String(t.id),
    personFubId: str(t.personId),
    title: str(t.name) ?? "(untitled task)",
    body: str(t.type),
    dueAt: str(t.dueDate),
    status: t.isCompleted ? "done" : "open",
  };
}

export function noteToLocal(n: FubNote) {
  return {
    fubId: String(n.id),
    personFubId: str(n.personId),
    subject: str(n.subject),
    body: str(n.body) ?? "",
    createdAt: str(n.created),
  };
}

/** Deal side/status are heuristics from pipeline/stage names — editable locally. */
export function dealToLocal(d: FubDeal) {
  const stage = nameOf(d.stage);
  const pipeline = nameOf(d.pipeline) ?? str(d.pipelineName);
  const status = str(d.status);
  const priceNum = typeof d.price === "number" ? d.price : d.price ? Number(String(d.price).replace(/[^0-9.]/g, "")) : null;
  const side = /list|sell/i.test(`${pipeline ?? ""} ${d.name ?? ""}`) ? "listing" : "buyer";
  let txStatus: "active" | "pending" | "closed" | "canceled" = "active";
  if (/won|closed/i.test(status ?? "") || /closed/i.test(stage ?? "")) txStatus = "closed";
  else if (/lost|cancel|dead/i.test(status ?? "")) txStatus = "canceled";
  else if (/pending|contract|escrow|inspection|appraisal/i.test(stage ?? "")) txStatus = "pending";
  return {
    fubId: String(d.id),
    personFubId: str(d.people?.[0]?.id) ?? str(d.personId),
    name: str(d.name) ?? `Deal ${d.id}`,
    price: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
    dealStatus: status,
    stage,
    pipeline,
    closeDate: str(d.closeDate),
    side,
    txStatus,
  };
}

export function appointmentToLocal(a: FubAppointment) {
  return {
    fubId: String(a.id),
    personFubId: str(a.invitees?.[0]?.personId),
    title: str(a.title) ?? "Appointment",
    description: str(a.description),
    startsAt: str(a.start),
    endsAt: str(a.end),
    location: str(a.location),
    type: typeof a.type === "string" ? a.type : str(a.type?.name),
  };
}

/** FUB `_metadata` pagination: returns the next offset or null when exhausted. */
export function nextOffset(meta: { offset?: number; limit?: number; total?: number } | undefined, received: number): number | null {
  const offset = meta?.offset ?? 0;
  const limit = meta?.limit ?? received;
  if (received === 0 || received < limit) return null;
  if (meta?.total != null && offset + received >= meta.total) return null;
  return offset + received;
}
