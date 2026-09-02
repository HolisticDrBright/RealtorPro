import "server-only";
import crypto from "node:crypto";
import {
  buildNotePayload,
  buildTaskPayload,
  type FubNoteInput,
  type FubTaskInput,
} from "./payloads";
import { nextOffset, type FubAppointment, type FubDeal, type FubNote, type FubPerson, type FubTask } from "./mappers";
import { AppError } from "@/lib/errors";

/**
 * Follow Up Boss adapter.
 *
 * Uses a user-provided API key (FUB_API_KEY) via HTTP Basic auth. Scope is
 * READ + draft/task WRITE only. With no key, the adapter runs in MOCK mode.
 * It NEVER sends messages/emails or creates leads — there are no methods for
 * those. Reads are paginated pulls; writes are explicit, one per user action.
 */

export type FubConnectionStatus = "connected" | "sync-error" | "disconnected";

export interface FubWriteResult {
  ok: boolean;
  fubId: string | null;
  mock: boolean;
  payload: unknown;
}

interface Page<T> {
  _metadata?: { offset?: number; limit?: number; total?: number };
  [key: string]: T[] | Page<T>["_metadata"] | undefined;
}

export class FubAdapter {
  private apiKey: string;
  private baseUrl: string;
  readonly mock: boolean;

  constructor() {
    this.apiKey = process.env.FUB_API_KEY?.trim() ?? "";
    this.baseUrl = (process.env.FUB_BASE_URL ?? "https://api.followupboss.com/v1").replace(/\/$/, "");
    this.mock = this.apiKey === "";
  }

  status(): FubConnectionStatus {
    return this.mock ? "disconnected" : "connected";
  }

  private authHeader(): string {
    return "Basic " + Buffer.from(`${this.apiKey}:`).toString("base64");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (this.mock) {
      throw new AppError("provider_error", "No Follow Up Boss API key is configured. Add FUB_API_KEY to .env to sync your real account.");
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: this.authHeader(), "X-System": "AgentOS", ...(init?.headers ?? {}) },
    });
    if (res.status === 401) throw new AppError("unauthorized", "Follow Up Boss rejected the API key. Check FUB_API_KEY.");
    if (res.status === 429) throw new AppError("rate_limited", "Follow Up Boss rate-limited the request. Your local copy is safe; retry shortly.");
    if (!res.ok) throw new AppError("provider_error", `Follow Up Boss returned ${res.status} for ${path}.`);
    return (await res.json()) as T;
  }

  /** Page through a collection endpoint (`/people` → key `people`). */
  private async listAll<T>(path: string, key: string, maxPages = 50): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    for (let i = 0; i < maxPages; i++) {
      const sep = path.includes("?") ? "&" : "?";
      const page = await this.request<Page<T>>(`${path}${sep}limit=100&offset=${offset}`);
      const items = (page[key] as T[] | undefined) ?? [];
      out.push(...items);
      const next = nextOffset(page._metadata, items.length);
      if (next == null) break;
      offset = next;
    }
    return out;
  }

  pullPeople() { return this.listAll<FubPerson>("/people", "people"); }
  pullTasks() { return this.listAll<FubTask>("/tasks", "tasks"); }
  pullNotes() { return this.listAll<FubNote>("/notes", "notes"); }
  pullDeals() { return this.listAll<FubDeal>("/deals", "deals"); }
  pullAppointments() { return this.listAll<FubAppointment>("/appointments", "appointments"); }

  /** Explicit, user-approved: create a task on a FUB-linked contact. */
  async createTask(input: FubTaskInput): Promise<FubWriteResult> {
    const payload = buildTaskPayload(input);
    if (this.mock) return { ok: true, fubId: null, mock: true, payload };
    const created = await this.request<{ id: number }>("/tasks", { method: "POST", body: JSON.stringify(payload) });
    return { ok: true, fubId: String(created.id), mock: false, payload };
  }

  /** Explicit, user-approved: add a DRAFT note on a FUB-linked contact. */
  async addNote(input: FubNoteInput): Promise<FubWriteResult> {
    const payload = buildNotePayload(input);
    if (this.mock) return { ok: true, fubId: null, mock: true, payload };
    const created = await this.request<{ id: number }>("/notes", { method: "POST", body: JSON.stringify(payload) });
    return { ok: true, fubId: String(created.id), mock: false, payload };
  }

  /** Verify an inbound FUB webhook signature (HMAC-SHA256 with FUB_WEBHOOK_SECRET). */
  static verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.FUB_WEBHOOK_SECRET?.trim();
    if (!secret || !signature) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

export function getFub(): FubAdapter {
  return new FubAdapter();
}
