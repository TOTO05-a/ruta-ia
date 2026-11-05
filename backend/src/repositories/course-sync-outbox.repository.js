const pool = require("../db/pool");

async function claimPending(limit = 1) {
    const result = await pool.query(
        `WITH due AS (
            SELECT id
            FROM course_qdrant_sync_outbox
            WHERE available_at <= now()
              AND (locked_until IS NULL OR locked_until <= now())
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            LIMIT $1
         )
         UPDATE course_qdrant_sync_outbox AS events
         SET locked_until = now() + interval '5 minutes',
             attempts = attempts + 1
         FROM due
         WHERE events.id = due.id
         RETURNING events.id, events.course_id AS "courseId", events.action,
                   events.version, events.payload`,
        [limit]
    );
    return result.rows;
}

async function acknowledge(id, version) {
    const result = await pool.query(
        `DELETE FROM course_qdrant_sync_outbox
         WHERE id = $1 AND version = $2
         RETURNING id`,
        [id, version]
    );
    return result.rowCount > 0;
}

module.exports = { claimPending, acknowledge };
