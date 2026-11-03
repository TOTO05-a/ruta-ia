const pool = require("../db/pool");

async function create(studentId, question) {
    const result = await pool.query(
        `INSERT INTO queries (student_id, question, status)
         VALUES ($1, $2, 'Pendiente')
         RETURNING id, student_id AS "studentId", question, status, created_at AS "createdAt"`,
        [studentId, question]
    );
    return result.rows[0];
}

async function markFailed(id, code) {
    await pool.query(
        `UPDATE queries SET status = 'Error', error_code = $2, completed_at = now()
         WHERE id = $1 AND status = 'Pendiente'`,
        [id, code]
    );
}

async function getById(id) {
    const result = await pool.query(
        `SELECT q.id, q.student_id AS "studentId", q.question, q.status,
                q.error_code AS "errorCode", q.created_at AS "createdAt", q.completed_at AS "completedAt",
                r.id AS "recommendationId", r.answer, r.summary, r.explanation,
                COALESCE(jsonb_agg(jsonb_build_object(
                    'courseId', c.id, 'name', c.name, 'description', c.description,
                    'category', c.category, 'level', c.level,
                    'intecapCareerType', c.intecap_career_type, 'durationHours', c.duration_hours,
                    'sourceUrl', c.source_url,
                    'similarity', rs.similarity_score, 'position', rs.position
                ) ORDER BY rs.position) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS sources
         FROM queries q
         LEFT JOIN recommendations r ON r.query_id = q.id
         LEFT JOIN recommendation_sources rs ON rs.recommendation_id = r.id
         LEFT JOIN courses c ON c.id = rs.course_id
         WHERE q.id = $1
         GROUP BY q.id, r.id`,
        [id]
    );
    return result.rows[0] || null;
}

async function listByStudent(studentId, { page, limit, status }) {
    const values = [studentId];
    const statusFilter = status ? `AND q.status = $${values.push(status)}` : "";
    const count = await pool.query(`SELECT count(*)::int AS total FROM queries q WHERE q.student_id = $1 ${statusFilter}`, values);
    values.push(limit, (page - 1) * limit);
    const result = await pool.query(
        `SELECT q.id, q.student_id AS "studentId", q.question, q.status,
                q.created_at AS "createdAt", q.completed_at AS "completedAt", r.summary,
                COALESCE(jsonb_agg(jsonb_build_object('courseId', c.id, 'name', c.name)
                  ORDER BY rs.position) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS sources
         FROM queries q LEFT JOIN recommendations r ON r.query_id = q.id
         LEFT JOIN recommendation_sources rs ON rs.recommendation_id = r.id
         LEFT JOIN courses c ON c.id = rs.course_id
         WHERE q.student_id = $1 ${statusFilter}
         GROUP BY q.id, r.id ORDER BY q.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
    );
    return { items: result.rows, total: count.rows[0].total, page, limit };
}

async function saveCallback(result) {
    const db = await pool.connect();
    try {
        await db.query("BEGIN");
        const current = await db.query("SELECT id, status FROM queries WHERE id = $1 FOR UPDATE", [result.queryId]);
        if (!current.rowCount) {
            await db.query("ROLLBACK");
            return { notFound: true };
        }
        if (current.rows[0].status !== "Pendiente") {
            await db.query("COMMIT");
            return { duplicate: true, status: current.rows[0].status };
        }

        if (result.status === "Sin resultados") {
            await db.query("UPDATE queries SET status = $2, completed_at = now() WHERE id = $1", [result.queryId, result.status]);
        } else if (result.status === "Error") {
            await db.query(
                "UPDATE queries SET status = 'Error', error_code = $2, completed_at = now() WHERE id = $1",
                [result.queryId, result.errorCode || "N8N_PROCESSING_ERROR"]
            );
        } else {
            const ids = result.sources.map((source) => source.courseId);
            if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_SOURCES");
            const active = await db.query("SELECT id FROM courses WHERE is_active = TRUE AND id = ANY($1::uuid[])", [ids]);
            if (active.rowCount !== ids.length) throw new Error("SOURCE_NOT_ACTIVE");

            const recommendation = await db.query(
                `INSERT INTO recommendations (query_id, answer, summary, explanation)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [result.queryId, result.answer, result.summary, result.explanation]
            );
            for (const [index, source] of result.sources.entries()) {
                await db.query(
                    `INSERT INTO recommendation_sources (recommendation_id, course_id, similarity_score, position)
                     VALUES ($1, $2, $3, $4)`,
                    [recommendation.rows[0].id, source.courseId, source.similarity, index + 1]
                );
            }
            await db.query(
                "UPDATE queries SET status = 'Respondida', completed_at = now() WHERE id = $1",
                [result.queryId]
            );
        }
        await db.query("COMMIT");
        return { status: result.status };
    } catch (error) {
        await db.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        db.release();
    }
}

module.exports = { create, markFailed, getById, listByStudent, saveCallback };
