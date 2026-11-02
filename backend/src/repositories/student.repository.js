const pool = require("../db/pool");

const studentFields = `id, full_name AS "fullName", email,
                       experience_level AS "experienceLevel", interest_area AS "interestArea",
                       role, created_at AS "createdAt"`;

async function updateProfile(id, changes) {
    const columns = { fullName: "full_name", experienceLevel: "experience_level", interestArea: "interest_area" };
    const entries = Object.entries(changes);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 1}`);
    assignments.push("updated_at = now()");
    values.push(id);
    const result = await pool.query(
        `UPDATE students SET ${assignments.join(", ")} WHERE id = $${values.length}
         RETURNING ${studentFields}`,
        values
    );
    return result.rows[0] || null;
}

async function list({ page, limit }) {
    const count = await pool.query("SELECT count(*)::int AS total FROM students");
    const result = await pool.query(
        `SELECT ${studentFields} FROM students ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, (page - 1) * limit]
    );
    return { items: result.rows, total: count.rows[0].total, page, limit };
}

async function findById(id) {
    const result = await pool.query(`SELECT ${studentFields} FROM students WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

module.exports = { updateProfile, list, findById };
