const { randomBytes } = require("node:crypto");
const pool = require("../db/pool");
const env = require("../config/env");
const { digest } = require("../middleware/require-auth");

async function createSession(studentId, db = pool) {
    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
    await db.query("DELETE FROM sessions WHERE expires_at < now()");
    await db.query(
        `INSERT INTO sessions (student_id, token_hash, csrf_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [studentId, digest(token), csrfToken, expiresAt]
    );
    return { token, csrfToken, expiresAt };
}

async function destroySession(sessionId) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

module.exports = { createSession, destroySession };
