// Never unlink a live database or its WAL/SHM files from a convenience script.
throw new Error("Database deletion is disabled. Use the app’s backed-up clear operation.");
export {};
