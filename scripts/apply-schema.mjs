// Applies supabase/schema.sql to the database configured in .env.local.
// Usage: npm run db:push
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const env = {};
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
      if (match) env[match[1]] = match[2];
    }
  } catch {
    // .env.local is optional if the variables are already in the environment
  }
  return env;
}

const fileEnv = loadEnvLocal();
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  fileEnv.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  fileEnv.POSTGRES_URL;

if (!connectionString) {
  console.error(
    "Missing POSTGRES_URL_NON_POOLING. Add it to .env.local or the environment.",
  );
  process.exit(1);
}

const sql = readFileSync(join(root, "supabase", "schema.sql"), "utf8");

// Drop any `sslmode` param so our explicit ssl config below is respected.
const cleanedConnection = connectionString
  .replace(/([?&])sslmode=[^&]*/i, "$1")
  .replace(/[?&]$/, "");

const client = new pg.Client({
  connectionString: cleanedConnection,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Schema applied successfully.");
} catch (error) {
  console.error("Failed to apply schema:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
