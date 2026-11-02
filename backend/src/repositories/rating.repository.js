const pool = require("../db/pool");

async function create(recommendationId, studentId, { score, comment }) {
    const db = await pool.connect();
    try {
        await db.query("BEGIN");
        const owner = await db.query(
            `SELECT q.student_id FROM recommendations r
             JOIN queries q ON q.id = r.query_id
             WHERE r.id = $1 FOR UPDATE OF r`,
            [recommendationId]
        );
        if (!owner.rowCount || owner.rows[0].student_id !== studentId) {
            await db.query("ROLLBACK");
            return { notFound: true };
        }

        const result = await db.query(
            `INSERT INTO ratings (recommendation_id, student_id, score, comment)
             VALUES ($1, $2, $3, $4)
             RETURNING id, recommendation_id AS "recommendationId", score, comment, created_at AS "createdAt"`,
            [recommendationId, studentId, score, comment || null]
        );
        await db.query("COMMIT");
        return result.rows[0];
    } catch (error) {
        await db.query("ROLLBACK").catch(() => {});
        if (error.code === "23505") return { duplicate: true };
        throw error;
    } finally {
        db.release();
    }
}

module.exports = { create };
