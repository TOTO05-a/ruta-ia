const pool = require("../db/pool");

async function getGlobal() {
    const totals = await pool.query(
        `SELECT count(*)::int AS total_queries,
                count(*) FILTER (WHERE status = 'Respondida')::int AS answered_queries,
                count(*) FILTER (WHERE status = 'Sin resultados')::int AS no_result_queries
         FROM queries`
    );
    const ratings = await pool.query("SELECT avg(score)::numeric(4,2) AS rating_average FROM ratings");
    const mostRecommended = await pool.query(
        `SELECT c.id, c.name, count(DISTINCT rs.recommendation_id)::int AS recommendation_count
         FROM recommendation_sources rs JOIN courses c ON c.id = rs.course_id
         GROUP BY c.id, c.name
         ORDER BY recommendation_count DESC, c.name ASC
         LIMIT 1`
    );
    return {
        totalQueries: totals.rows[0].total_queries,
        answeredQueries: totals.rows[0].answered_queries,
        noResultQueries: totals.rows[0].no_result_queries,
        averageRating: ratings.rows[0].rating_average === null ? null : Number(ratings.rows[0].rating_average),
        mostRecommendedCourse: mostRecommended.rows[0] || null
    };
}

module.exports = { getGlobal };
