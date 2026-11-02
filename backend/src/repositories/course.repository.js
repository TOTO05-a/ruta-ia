const pool = require("../db/pool");

const columns = `id, name, description, category, level, duration_hours AS "durationHours",
                 is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`;

async function list({ search, category, level, page, limit }, { includeInactive = false } = {}) {
    const values = [];
    const filters = [];
    if (!includeInactive) filters.push("is_active = TRUE");
    if (search) {
        values.push(`%${search}%`);
        filters.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    if (category) {
        values.push(category);
        filters.push(`category = $${values.length}`);
    }
    if (level) {
        values.push(level);
        filters.push(`level = $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await pool.query(`SELECT count(*)::int AS total FROM courses ${where}`, values);
    values.push(limit, (page - 1) * limit);
    const result = await pool.query(
        `SELECT ${columns} FROM courses ${where} ORDER BY name ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
    );
    return { items: result.rows, total: count.rows[0].total, page, limit };
}

async function findById(id, { includeInactive = false } = {}) {
    const result = await pool.query(
        `SELECT ${columns} FROM courses WHERE id = $1 ${includeInactive ? "" : "AND is_active = TRUE"}`,
        [id]
    );
    return result.rows[0] || null;
}

async function create(course) {
    const result = await pool.query(
        `INSERT INTO courses (name, description, category, level, duration_hours)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`,
        [course.name, course.description, course.category, course.level, course.durationHours]
    );
    return result.rows[0];
}

async function update(id, changes) {
    const map = { name: "name", description: "description", category: "category", level: "level", durationHours: "duration_hours" };
    const entries = Object.entries(changes).filter(([key]) => map[key]);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${map[key]} = $${index + 1}`);
    assignments.push("updated_at = now()");
    values.push(id);
    const result = await pool.query(
        `UPDATE courses SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING ${columns}`,
        values
    );
    return result.rows[0] || null;
}

async function setActive(id, isActive) {
    const result = await pool.query(
        `UPDATE courses SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING ${columns}`,
        [isActive, id]
    );
    return result.rows[0] || null;
}

async function listAllActive() {
    const result = await pool.query(
        `SELECT id, name, description, category, level, duration_hours AS "durationHours"
         FROM courses WHERE is_active = TRUE ORDER BY id`
    );
    return result.rows;
}

module.exports = { list, findById, create, update, setActive, listAllActive };
