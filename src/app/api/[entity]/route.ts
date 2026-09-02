import type { NextRequest } from "next/server";
import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { defaultSort, schemas, searchable, tables, type EntityName } from "@/lib/registry";
import { afterCreate } from "@/services/hooks";
import { readJson } from "@/lib/api";
import { AppError, errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

function resolve(name: string): EntityName {
  if (!(name in tables)) throw new AppError("not_found", `Unknown collection: ${name}`);
  return name as EntityName;
}

/**
 * Generic list: `?field=value` (comma = any of), `?q=` text search over the
 * entity's searchable columns, `?sort=&dir=&limit=&offset=`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  try {
    const entity = resolve((await ctx.params).entity);
    const table = tables[entity];
    const cols = getTableColumns(table) as Record<string, SQL.Aliased | { name: string }>;
    const sp = req.nextUrl.searchParams;
    const where: SQL[] = [];
    for (const [k, v] of sp.entries()) {
      if (["q", "sort", "dir", "limit", "offset"].includes(k) || !(k in cols)) continue;
      const col = (table as unknown as Record<string, never>)[k];
      const vals = v.split(",").filter((x) => x !== "");
      if (vals.length === 0) continue;
      if (vals.length === 1) where.push(vals[0] === "null" ? sql`${col} is null` : eq(col, vals[0] === "true" ? true : vals[0] === "false" ? false : vals[0]));
      else where.push(inArray(col, vals));
    }
    const q = sp.get("q")?.trim();
    if (q && searchable[entity].length) where.push(or(...searchable[entity].map((c) => like((table as unknown as Record<string, never>)[c], `%${q}%`)))!);
    const sortKey = sp.get("sort") && sp.get("sort")! in cols ? sp.get("sort")! : defaultSort[entity].column;
    const dir = (sp.get("dir") ?? defaultSort[entity].dir) === "desc" ? desc : asc;
    const limit = Math.min(1000, Number(sp.get("limit") ?? 500));
    const offset = Number(sp.get("offset") ?? 0);
    const rows = db.select().from(table).where(where.length ? and(...where) : undefined).orderBy(dir((table as unknown as Record<string, never>)[sortKey])).limit(limit).offset(offset).all();
    return ok({ items: rows, count: rows.length });
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  try {
    const entity = resolve((await ctx.params).entity);
    const input = await readJson(req, schemas[entity]);
    const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
    const row = db.insert(tables[entity]).values(clean as never).returning().get() as Record<string, unknown>;
    afterCreate(entity, row);
    return ok({ item: row }, { status: 201 });
  } catch (err) { return errorResponse(err); }
}
