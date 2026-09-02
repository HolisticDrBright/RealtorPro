import type { NextRequest } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { todos } from "@/db/schema.dashboard";
import { readJson } from "@/lib/api";
import { todayYmd } from "@/services/dashboard";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  kind: z.enum(["task", "priority", "call"]).default("task"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

/** Bulk import: paste a daily list (one item per line; "!" prefix = priority, "call:" prefix = call). */
const importSchema = z.object({ text: z.string().min(1).max(10000), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get("date") ?? todayYmd();
    return ok({ todos: db.select().from(todos).where(eq(todos.dueDate, date)).orderBy(asc(todos.createdAt)).all() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.clone().json().catch(() => ({}))) as { text?: string };
    if (typeof raw.text === "string") {
      const input = importSchema.parse(raw);
      const due = input.dueDate ?? todayYmd();
      const rows = input.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          let kind: "task" | "priority" | "call" = "task";
          let title = line.replace(/^[-*•]\s*/, "");
          if (/^!/.test(title)) { kind = "priority"; title = title.replace(/^!\s*/, ""); }
          else if (/^call:/i.test(title)) { kind = "call"; title = title.replace(/^call:\s*/i, ""); }
          return db.insert(todos).values({ title, kind, dueDate: due, source: "import" }).returning().get();
        });
      writeAudit({ action: "todos.imported", metadata: { count: rows.length, due } });
      return ok({ todos: rows }, { status: 201 });
    }
    const input = await readJson(req, createSchema);
    const row = db.insert(todos).values({ ...input, dueDate: input.dueDate ?? todayYmd() }).returning().get();
    return ok({ todo: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
