import "server-only";
import { db } from "@/db";
import * as s from "@/db/schema";

/** Cheap lookups shared by the computed endpoints (single-user, local DB). */
export function loadContext() {
  const contacts = db.select().from(s.contacts).all();
  const properties = db.select().from(s.properties).all();
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const fullName = (c: { firstName: string; lastName: string } | undefined | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : null);
  return {
    contacts,
    properties,
    contactById,
    propertyById,
    names: (id: string | null | undefined) => (id ? fullName(contactById.get(id)) : null),
    contact: (id: string | null | undefined) => (id ? contactById.get(id) ?? null : null),
    addresses: (id: string | null | undefined) => (id ? propertyById.get(id)?.address ?? null : null),
    property: (id: string | null | undefined) => (id ? propertyById.get(id) ?? null : null),
    settings: db.select().from(s.settings).get() ?? null,
  };
}
export type Ctx = ReturnType<typeof loadContext>;
