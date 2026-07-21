import path from "node:path";

/**
 * Centralised filesystem layout for AgentOS local storage.
 *
 * Everything AgentOS persists — the SQLite database, uploaded originals,
 * generated output, and exports — lives under a single workspace directory that
 * sits OUTSIDE the Next.js `public/` folder, so no local asset is ever served as
 * a static file. The location is configurable via `AGENTOS_WORKSPACE_DIR`.
 *
 * This module has no side effects and no dependency on the database, so it can
 * be imported by `drizzle.config.ts`, scripts, and server code alike.
 */

export const WORKSPACE_DIR = path.resolve(
  process.env.AGENTOS_WORKSPACE_DIR?.trim() || "./workspace",
);

/** SQLite database file. */
export const DB_FILE = path.join(WORKSPACE_DIR, "agentos.db");

/** Uploaded original assets (images, floor plans, video). Immutable. */
export const ASSETS_DIR = path.join(WORKSPACE_DIR, "assets");

/** Original, immutable source documents (uploaded CSVs, PDFs, pasted text). */
export const SOURCES_DIR = path.join(WORKSPACE_DIR, "sources");

/** Generated output from the Listing Studio job queue. */
export const GENERATED_DIR = path.join(WORKSPACE_DIR, "generated");

/** Zipped exports of local data. */
export const EXPORTS_DIR = path.join(WORKSPACE_DIR, "exports");

/** All directories that should exist before AgentOS reads or writes files. */
export const WORKSPACE_SUBDIRS = [
  WORKSPACE_DIR,
  ASSETS_DIR,
  SOURCES_DIR,
  GENERATED_DIR,
  EXPORTS_DIR,
];
