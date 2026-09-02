"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tiny data layer: `useApi(url)` fetches JSON and re-fetches whenever any
 * mutation happens anywhere in the app (`bump()`), so lists, KPIs and the
 * dashboard stay in sync after a save without prop-drilling.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
export function bump() { for (const l of listeners) l(); }

export function useApi<T>(url: string | null, opts?: { refreshMs?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const first = useRef(true);
  const load = useCallback(() => {
    if (!url) return;
    if (first.current) setLoading(true);
    fetch(url)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message ?? "Failed to load"); setData(j); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => { setLoading(false); first.current = false; });
  }, [url]);
  useEffect(() => { first.current = true; load(); }, [load]);
  useEffect(() => { listeners.add(load); return () => { listeners.delete(load); }; }, [load]);
  useEffect(() => {
    if (!opts?.refreshMs) return;
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), opts.refreshMs);
    return () => window.clearInterval(id);
  }, [load, opts?.refreshMs]);
  return { data, error, loading, reload: load };
}

export interface ApiResult<T = unknown> { ok: boolean; data: T; message?: string }

async function call<T = unknown>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, data, message: data?.error?.message ?? `Request failed (${res.status})` };
    bump();
    return { ok: true, data };
  } catch {
    return { ok: false, data: null as T, message: "Network error — nothing was changed." };
  }
}
export const api = {
  create: <T = unknown>(entity: string, body: unknown) => call<{ item: T }>("POST", `/api/${entity}`, body),
  update: <T = unknown>(entity: string, id: string, body: unknown) => call<{ item: T }>("PATCH", `/api/${entity}/${id}`, body),
  remove: (entity: string, id: string) => call("DELETE", `/api/${entity}/${id}`),
  post: <T = unknown>(url: string, body?: unknown) => call<T>("POST", url, body ?? {}),
};

/** Toasts */
const toastListeners = new Set<(msg: string, kind: "ok" | "err") => void>();
export function toast(msg: string, kind: "ok" | "err" = "ok") { for (const l of toastListeners) l(msg, kind); }
export function useToasts() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  useEffect(() => {
    const l = (msg: string, kind: "ok" | "err") => { const id = Date.now() + Math.random(); setItems((s) => [...s, { id, msg, kind }]); setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3200); };
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return items;
}

/** Lookups: contacts + properties for pickers and joins (small, cached per mount). */
export interface ContactLite { id: string; firstName: string; lastName: string; type: string; phone: string | null; email: string | null; photoUrl: string | null; stage: string; lastContactAt: string | null; nextFollowUpAt: string | null; leadSource: string | null; tags: string[] | null; birthday: string | null }
export interface PropertyLite { id: string; address: string; city: string; zip: string | null; yearBuilt: number | null; beds: number | null; baths: number | null; sqft: number | null; lotSqft: number | null; photoUrl: string | null; propertyType: string | null; view: string | null }
export function useLookups() {
  const c = useApi<{ items: ContactLite[] }>("/api/contacts?limit=1000");
  const p = useApi<{ items: PropertyLite[] }>("/api/properties?limit=1000");
  const contacts = c.data?.items ?? [];
  const properties = p.data?.items ?? [];
  const nameOf = (id: string | null | undefined) => { const x = contacts.find((k) => k.id === id); return x ? `${x.firstName} ${x.lastName}`.trim() : null; };
  const contactOf = (id: string | null | undefined) => contacts.find((k) => k.id === id) ?? null;
  const addressOf = (id: string | null | undefined) => properties.find((k) => k.id === id)?.address ?? null;
  const propertyOf = (id: string | null | undefined) => properties.find((k) => k.id === id) ?? null;
  return { contacts, properties, nameOf, contactOf, addressOf, propertyOf, ready: !!c.data && !!p.data };
}

export const fullName = (c: { firstName: string; lastName: string } | null | undefined) => (c ? `${c.firstName} ${c.lastName}`.trim() : "—");
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "—");
export const telHref = (p: string | null | undefined) => (p ? `tel:${p.replace(/[^\d+]/g, "")}` : undefined);
export const smsHref = (p: string | null | undefined) => (p ? `sms:${p.replace(/[^\d+]/g, "")}` : undefined);

/** Read a URL query param on the client without forcing a Suspense boundary (static-prerender safe). */
export function useQueryParam(key: string): string | null {
  const [v, setV] = useState<string | null>(null);
  useEffect(() => { try { setV(new URLSearchParams(window.location.search).get(key)); } catch { /* ssr */ } }, [key]);
  return v;
}
