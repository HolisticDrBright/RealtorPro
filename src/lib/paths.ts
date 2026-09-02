import path from "node:path";

/** Local workspace: the SQLite database lives here (gitignored). */
export const WORKSPACE_DIR = path.resolve(process.cwd(), process.env.WORKSPACE_DIR ?? "./workspace");
export const DB_FILE = path.join(WORKSPACE_DIR, "command-center.db");
export const WORKSPACE_SUBDIRS = [WORKSPACE_DIR];
