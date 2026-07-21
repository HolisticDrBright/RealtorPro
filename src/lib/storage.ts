import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { WORKSPACE_DIR, WORKSPACE_SUBDIRS } from "./paths";
import { AppError } from "./errors";

/**
 * Safe local file storage. All writes are confined to the workspace directory,
 * which lives OUTSIDE `public/` so nothing is served statically. Filenames are
 * sanitised and every resolved path is verified to remain inside the workspace,
 * defeating path-traversal (`../`, absolute paths, symlink tricks).
 */

export function ensureWorkspace() {
  for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
}

/** Strip anything that could escape a directory or be unsafe on disk. */
export function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const trimmed = base.replace(/^\.+/, "").slice(0, 180);
  return trimmed || "file";
}

/**
 * Resolve `segments` under the workspace and assert the result stays inside it.
 * Throws `unsafe_path` if traversal is attempted.
 */
export function safeJoin(...segments: string[]): string {
  const resolved = path.resolve(WORKSPACE_DIR, ...segments);
  const root = path.resolve(WORKSPACE_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new AppError("unsafe_path", "Refusing to access a path outside the workspace.");
  }
  return resolved;
}

export function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

const ALLOWED_MIME: Record<string, string[]> = {
  mls_csv: ["text/csv", "application/vnd.ms-excel", "application/csv", "text/plain"],
  pdf: ["application/pdf"],
  image: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/tiff"],
  floorplan: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
};

export function assertAllowedMime(kind: keyof typeof ALLOWED_MIME, mime: string) {
  const allowed = ALLOWED_MIME[kind];
  if (!allowed || !allowed.includes(mime)) {
    throw new AppError(
      "unprocessable",
      `File type "${mime}" is not allowed for ${kind}. Allowed: ${allowed?.join(", ") ?? "none"}.`,
    );
  }
}

export interface StoredFile {
  storedPath: string; // workspace-relative
  absolutePath: string;
  sha256: string;
  byteSize: number;
  filename: string;
}

/** Write a buffer into a workspace subdirectory, content-addressed by hash. */
export function storeFile(
  subdir: "assets" | "sources" | "generated" | "exports",
  originalName: string,
  buf: Buffer,
): StoredFile {
  ensureWorkspace();
  const hash = sha256(buf);
  const clean = safeFilename(originalName);
  const filename = `${hash.slice(0, 12)}-${clean}`;
  const absolutePath = safeJoin(subdir, filename);
  fs.writeFileSync(absolutePath, buf);
  return {
    storedPath: path.join(subdir, filename),
    absolutePath,
    sha256: hash,
    byteSize: buf.byteLength,
    filename: clean,
  };
}
