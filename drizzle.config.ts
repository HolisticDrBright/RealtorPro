import type { Config } from "drizzle-kit";
import { DB_FILE } from "./src/lib/paths";

export default {
  schema: ["./src/db/schema.ts", "./src/db/schema.modules.ts"],
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_FILE,
  },
  strict: true,
} satisfies Config;
