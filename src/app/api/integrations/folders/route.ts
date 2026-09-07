import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AppError, errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const requested = req.nextUrl.searchParams.get("path") || os.homedir();
    if (!path.isAbsolute(requested)) throw new AppError("bad_request", "Use a full folder path.");
    const dir = fs.realpathSync(requested);
    const folders = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith(".")).map((e) => ({ name: e.name, path: path.join(dir, e.name) })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 500);
    return ok({ path: dir, parent: path.dirname(dir), isVault: fs.existsSync(path.join(dir, ".obsidian")), folders });
  } catch (err) { return errorResponse(err instanceof AppError ? err : new AppError("bad_request", "Cannot open that folder. Check the path and permissions.")); }
}
