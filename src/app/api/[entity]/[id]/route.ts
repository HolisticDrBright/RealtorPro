import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schemas, tables, type EntityName } from "@/lib/registry";
import { afterUpdate } from "@/services/hooks";
import { readJson } from "@/lib/api";
import { AppError, errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ entity: string; id: string }> };

function resolve(name: string): EntityName {
  if (!(name in tables)) throw new AppError("not_found", `Unknown collection: ${name}`);
  return name as EntityName;
}
function load(entity: EntityName, id: string): Record<string, unknown> {
  const t = tables[entity];
  const row = db.select().from(t).where(eq((t as unknown as { id: never }).id, id)).get();
  if (!row) throw new AppError("not_found", "That record no longer exists.");
  return row as Record<string, unknown>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try { const { entity, id } = await ctx.params; return ok({ item: load(resolve(entity), id) }); } catch (err) { return errorResponse(err); }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { entity: name, id } = await ctx.params;
    const entity = resolve(name);
    const before = load(entity, id);
    const input = await readJson(req, (schemas[entity] as unknown as { partial: () => never }).partial());
    const patch = Object.fromEntries(Object.entries(input as Record<string, unknown>).filter(([, v]) => v !== undefined));
    if ("email" in patch && patch.email === "") patch.email = null;
    const t = tables[entity];
    const hasUpdatedAt = "updatedAt" in t;
    db.update(t).set({ ...patch, ...(hasUpdatedAt ? { updatedAt: new Date().toISOString() } : {}) } as never).where(eq((t as unknown as { id: never }).id, id)).run();
    const after = load(entity, id);
    afterUpdate(entity, before, after);
    return ok({ item: load(entity, id) });
  } catch (err) { return errorResponse(err); }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { entity: name, id } = await ctx.params;
    const entity = resolve(name);
    load(entity, id);
    const t = tables[entity];
    db.delete(t).where(eq((t as unknown as { id: never }).id, id)).run();
    return ok({ deleted: true });
  } catch (err) { return errorResponse(err); }
}
