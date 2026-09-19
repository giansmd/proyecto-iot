import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../../config.js";
import { createDb } from "./db.js";

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

try {
  console.log(`[migrate] aplicando migraciones desde ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] migraciones aplicadas");
  process.exitCode = 0;
} catch (error) {
  console.error("[migrate] error:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
