const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: env.NODE_ENV === "test"
});

pool.on("error", (error) => {
    // Do not log query parameters or connection strings.
    console.error("Error inesperado en conexión PostgreSQL", error.code || "UNKNOWN");
});

module.exports = pool;
