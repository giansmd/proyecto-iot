import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>["db"];
