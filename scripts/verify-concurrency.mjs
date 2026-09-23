// Verifies that concurrent uploads are allocated to distinct pieces.
// Usage: node scripts/verify-concurrency.mjs
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
    /* ignore */
  }
  return env;
}

const fileEnv = loadEnvLocal();
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || fileEnv.POSTGRES_URL_NON_POOLING;
if (!connectionString) {
  console.error("Missing POSTGRES_URL_NON_POOLING");
  process.exit(1);
}

const cleaned = connectionString
  .replace(/([?&])sslmode=[^&]*/i, "$1")
  .replace(/[?&]$/, "");

const pool = new pg.Pool({
  connectionString: cleaned,
  ssl: { rejectUnauthorized: false },
  max: 16,
});

const TOTAL = 10;
const ATTEMPTS = 14;

try {
  const created = await pool.query("select new_game($1, $2) as id", [
    TOTAL,
    "/eagle.svg",
  ]);
  const gameId = created.rows[0].id;
  console.log("Test game:", gameId);

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, (_, i) =>
      pool
        .query("select * from allocate_piece($1, $2, $3)", [
          gameId,
          `https://example.test/${i}.jpg`,
          `ref-${i}`,
        ])
        .then((r) => ({ ok: true, row: r.rows[0] }))
        .catch((e) => ({ ok: false, error: e.message })),
    ),
  );

  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const indices = successes.map((r) => r.row.piece_index).sort((a, b) => a - b);
  const unique = new Set(indices);

  console.log("Successes:", successes.length);
  console.log("Failures:", failures.length, failures.map((f) => f.error));
  console.log("Indices:", indices.join(", "));

  const finalGame = await pool.query("select * from games where id = $1", [
    gameId,
  ]);
  console.log("Final game:", finalGame.rows[0]);

  const ok =
    successes.length === TOTAL &&
    unique.size === TOTAL &&
    failures.length === ATTEMPTS - TOTAL &&
    indices.join(",") === Array.from({ length: TOTAL }, (_, i) => i + 1).join(",");

  console.log(ok ? "PASS: no duplicate pieces" : "FAIL: allocation problem");

  await pool.query("delete from games where id = $1", [gameId]);
  console.log("Cleaned up test game.");
  process.exitCode = ok ? 0 : 1;
} catch (error) {
  console.error("Verification error:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
