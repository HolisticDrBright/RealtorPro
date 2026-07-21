import "server-only";
import crypto from "node:crypto";
import {
  buildNotePayload,
  buildTaskPayload,
  type FubNoteInput,
  type FubTaskInput,
} from "./payloads";
import { AppError } from "@/lib/errors";

/**
 * Follow Up Boss adapter.
 *
 * Uses a user-provided API key (FUB_API_KEY) via HTTP Basic auth, per FUB's API.
 * Scope is READ + draft/task WRITE only. With no key, the adapter runs in MOCK
 * mode so the whole sync/write workflow is exercisable locally.
 *
 * It NEVER sends messages/emails or creates leads — there are simply no methods
 * for those. Writes are explicit, one call per user-approved action.
 */

export type FubConnectionStatus = "connected" | "sync-error" | "disconnected";

export interface FubSyncResult {
  pulled: { entity: string; count: number }[];
  pushed: { entity: string; count: number }[];
  status: "OK" | "error";
  detail: string;
}

export interface FubWriteResult {
  ok: boolean;
  fubId: string | null;
  mock: boolean;
  payload: unknown;
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
    // FUB uses HTTP Basic with the API key as the username and an empty password.
    return "Basic " + Buffer.from(`${this.apiKey}:`).toString("base64");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (this.mock) {
      throw new AppError(
        "provider_error",
        "No Follow Up Boss API key is configured. Add FUB_API_KEY to use the real account, or continue in local mock mode.",
      );
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: this.authHeader(),
        "X-System": "AgentOS",
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 429) {
      throw new AppError("rate_limited", "Follow Up Boss rate-limited the request. Your local copy is safe; retry shortly.");
    }
    if (!res.ok) {
      throw new AppError("provider_error", `Follow Up Boss returned ${res.status}.`);
    }
    return (await res.json()) as T;
  }

  /** Manual pull of assigned records. In mock mode returns a summary only. */
  async sync(): Promise<FubSyncResult> {
    if (this.mock) {
      return {
        pulled: [
          { entity: "contacts", count: 3 },
          { entity: "tasks", count: 1 },
        ],
        pushed: [{ entity: "drafts", count: 2 }],
        status: "OK",
        detail: "Mock sync — no FUB key configured. 3 records pulled, 2 drafts pushed (simulated).",
      };
    }
    // Real pull would page through /people, /tasks, /notes, /deals, /appointments
    // and upsert by FUB id (never by name). Kept as a single representative call.
    const people = await this.request<{ people?: unknown[] }>("/people?limit=25");
    const count = people.people?.length ?? 0;
    return {
      pulled: [{ entity: "contacts", count }],
      pushed: [],
      status: "OK",
      detail: `Pulled ${count} contacts from Follow Up Boss.`,
    };
  }

  /** Explicit, user-approved: create a task on a FUB-linked contact. */
  async createTask(input: FubTaskInput): Promise<FubWriteResult> {
    const payload = buildTaskPayload(input);
    if (this.mock) {
      return { ok: true, fubId: null, mock: true, payload };
    }
    const created = await this.request<{ id: number }>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: true, fubId: String(created.id), mock: false, payload };
  }

  /** Explicit, user-approved: add a DRAFT note on a FUB-linked contact. */
  async addNote(input: FubNoteInput): Promise<FubWriteResult> {
    const payload = buildNotePayload(input);
    if (this.mock) {
      return { ok: true, fubId: null, mock: true, payload };
    }
    const created = await this.request<{ id: number }>("/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: true, fubId: String(created.id), mock: false, payload };
  }

  /**
   * Verify an inbound FUB webhook signature (HMAC-SHA256 of the raw body with the
   * shared secret). Real-time webhooks require a secure hosted relay — the local
   * receiver is for development/documentation only. Returns false if no secret.
   */
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
