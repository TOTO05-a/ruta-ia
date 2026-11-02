require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../.env") });

const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../src/db/pool");

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [2026110201]);
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);

        const version = "001_initial_schema";
        const found = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
        if (found.rowCount) {
            await client.query("COMMIT");
            console.log(`Migración ${version} ya aplicada`);
            return;
        }

        const sql = await fs.readFile(path.resolve(__dirname, "../../database/migrations/001_initial_schema.sql"), "utf8");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
        await client.query("COMMIT");
        console.log(`Migración ${version} aplicada`);
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((error) => {
    console.error("No se pudo aplicar la migración", error.code || error.name);
    process.exitCode = 1;
});
