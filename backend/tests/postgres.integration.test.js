const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const dotenv = require("dotenv");

const workspaceRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(workspaceRoot, ".env") });

test("API, PostgreSQL y callbacks mantienen contratos e integridad", {
    skip: process.env.RUTAIA_RUN_INTEGRATION_TESTS !== "1"
}, async () => {
    const testDatabaseUrl = process.env.RUTAIA_TEST_DATABASE_URL;
    assert.ok(testDatabaseUrl, "Define RUTAIA_TEST_DATABASE_URL para la base aislada rutaia_test");
    const parsedDatabaseUrl = new URL(testDatabaseUrl);
    assert.ok(["localhost", "127.0.0.1"].includes(parsedDatabaseUrl.hostname), "La base de integración debe estar en loopback local");
    assert.equal(parsedDatabaseUrl.pathname, "/rutaia_test", "Solo se permite usar la base dedicada rutaia_test");

    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_EMBEDDING_MODEL = "";
    process.env.OPENROUTER_CHAT_MODEL = "";
    process.env.RAG_MIN_SIMILARITY = "";

    execFileSync(process.execPath, ["scripts/migrate.js"], {
        cwd: path.resolve(__dirname, ".."),
        env: process.env,
        stdio: "inherit"
    });

    const app = require("../src/app");
    const pool = require("../src/db/pool");
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const studentIds = [];
    const courseIds = [];
    const queryIds = [];
    const suffix = crypto.randomUUID();
    let cleanupError;

    async function request(route, { method = "GET", cookie, csrf, body, headers = {} } = {}) {
        const requestHeaders = new Headers(headers);
        if (cookie) requestHeaders.set("cookie", cookie);
        if (csrf) requestHeaders.set("x-csrf-token", csrf);
        if (body !== undefined) {
            requestHeaders.set("content-type", "application/json");
        }
        return fetch(`${baseUrl}${route}`, {
            method,
            headers: requestHeaders,
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    async function register(label) {
        const email = `rutaia-itest-${suffix}-${label}@example.invalid`;
        const response = await request("/api/v1/auth/register", {
            method: "POST",
            body: {
                fullName: `RutaIA Integration ${label}`,
                email,
                password: "Integration-Only-42!",
                experienceLevel: "Principiante",
                interestArea: "Pruebas PostgreSQL"
            }
        });
        assert.equal(response.status, 201);
        const result = await response.json();
        const setCookie = response.headers.get("set-cookie");
        assert.match(setCookie || "", /HttpOnly/);
        assert.match(setCookie || "", /SameSite=Lax/);
        const student = result.data.student;
        studentIds.push(student.id);
        return { ...student, csrfToken: result.data.csrfToken, cookie: setCookie.split(";", 1)[0] };
    }

    async function insertPendingQuery(studentId, question) {
        const result = await pool.query(
            "INSERT INTO queries (student_id, question, status) VALUES ($1, $2, 'Pendiente') RETURNING id",
            [studentId, question]
        );
        queryIds.push(result.rows[0].id);
        return result.rows[0].id;
    }

    async function cleanup() {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                "DELETE FROM ratings WHERE recommendation_id IN (SELECT id FROM recommendations WHERE query_id = ANY($1::uuid[]))",
                [queryIds]
            );
            await client.query(
                "DELETE FROM recommendation_sources WHERE recommendation_id IN (SELECT id FROM recommendations WHERE query_id = ANY($1::uuid[]))",
                [queryIds]
            );
            await client.query("DELETE FROM recommendations WHERE query_id = ANY($1::uuid[])", [queryIds]);
            await client.query("DELETE FROM queries WHERE id = ANY($1::uuid[])", [queryIds]);
            await client.query("DELETE FROM courses WHERE id = ANY($1::uuid[])", [courseIds]);
            await client.query("DELETE FROM students WHERE id = ANY($1::uuid[])", [studentIds]);
            await client.query("COMMIT");
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    try {
        const existing = await pool.query(
            "SELECT (SELECT count(*) FROM students)::int AS students, (SELECT count(*) FROM courses)::int AS courses, (SELECT count(*) FROM queries)::int AS queries, (SELECT count(*) FROM recommendations)::int AS recommendations, (SELECT count(*) FROM ratings)::int AS ratings"
        );
        assert.deepEqual(existing.rows[0], { students: 0, courses: 0, queries: 0, recommendations: 0, ratings: 0 }, "Recrea rutaia_test si contiene datos previos");

        const admin = await register("admin");
        const owner = await register("owner");
        const other = await register("other");
        await pool.query("UPDATE students SET role = 'admin' WHERE id = $1", [admin.id]);

        const csrfDenied = await request("/api/v1/admin/courses", {
            method: "POST", cookie: admin.cookie,
            body: {
                name: "RutaIA Integration CSRF denial",
                description: "Este curso no debe crearse si falta la protección CSRF.",
                category: "Integration",
                level: "Básico",
                durationHours: 1
            }
        });
        assert.equal(csrfDenied.status, 403);
        assert.equal((await csrfDenied.json()).error.code, "CSRF_INVALID");

        const studentAdminRoute = await request(`/api/v1/students/${other.id}`, { cookie: owner.cookie });
        assert.equal(studentAdminRoute.status, 403);
        assert.equal((await studentAdminRoute.json()).error.code, "FORBIDDEN");

        const missingId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
        const missingCourse = await request(`/api/v1/courses/${missingId}`);
        assert.equal(missingCourse.status, 404);
        assert.equal((await missingCourse.json()).error.code, "COURSE_NOT_FOUND");
        const missingStudent = await request(`/api/v1/students/${missingId}`, { cookie: admin.cookie });
        assert.equal(missingStudent.status, 404);
        assert.equal((await missingStudent.json()).error.code, "STUDENT_NOT_FOUND");
        const invalidCourseId = await request("/api/v1/courses/not-a-uuid");
        assert.equal(invalidCourseId.status, 400);
        assert.equal((await invalidCourseId.json()).error.code, "VALIDATION_ERROR");
        const missingQuery = await request(`/api/v1/queries/${missingId}`, { cookie: owner.cookie });
        assert.equal(missingQuery.status, 404);
        assert.equal((await missingQuery.json()).error.code, "QUERY_NOT_FOUND");

        const duplicate = await request("/api/v1/auth/register", {
            method: "POST",
            body: {
                fullName: "RutaIA Integration Duplicate",
                email: `rutaia-itest-${suffix}-owner@example.invalid`,
                password: "Integration-Only-42!",
                experienceLevel: "Principiante",
                interestArea: "Pruebas PostgreSQL"
            }
        });
        assert.equal(duplicate.status, 409);

        const courses = [];
        for (const [label, level] of [["basic-a", "Básico"], ["basic-b", "Básico"], ["intermediate", "Intermedio"]]) {
            const response = await request("/api/v1/admin/courses", {
                method: "POST",
                cookie: admin.cookie,
                csrf: admin.csrfToken,
                body: {
                    name: `RutaIA Integration ${suffix} ${label}`,
                    description: "Curso sintético exclusivo para probar la API relacional de integración.",
                    category: `Integration-${suffix}`,
                    level,
                    durationHours: 4
                }
            });
            assert.equal(response.status, 201);
            const result = await response.json();
            courses.push(result.data);
            courseIds.push(result.data.id);
        }

        const basicFilter = new URLSearchParams({ category: `Integration-${suffix}`, level: "Básico", page: "1", limit: "1" });
        const firstPage = await (await request(`/api/v1/courses?${basicFilter}`)).json();
        assert.equal(firstPage.data.total, 2);
        assert.equal(firstPage.data.items.length, 1);
        const secondPageFilter = new URLSearchParams({ category: `Integration-${suffix}`, level: "Básico", page: "2", limit: "1" });
        const secondPage = await (await request(`/api/v1/courses?${secondPageFilter}`)).json();
        assert.equal(secondPage.data.items.length, 1);
        assert.notEqual(firstPage.data.items[0].id, secondPage.data.items[0].id);

        const toggledId = courses[0].id;
        const disable = await request(`/api/v1/admin/courses/${toggledId}/status`, {
            method: "PATCH", cookie: admin.cookie, csrf: admin.csrfToken, body: { isActive: false }
        });
        assert.equal((await disable.json()).data.isActive, false);
        const hidden = await request(`/api/v1/courses?search=${encodeURIComponent(courses[0].name)}`);
        assert.equal((await hidden.json()).data.total, 0);
        const adminInactive = await request(`/api/v1/admin/courses/${toggledId}`, { cookie: admin.cookie });
        assert.equal((await adminInactive.json()).data.isActive, false);
        const enable = await request(`/api/v1/admin/courses/${toggledId}/status`, {
            method: "PATCH", cookie: admin.cookie, csrf: admin.csrfToken, body: { isActive: true }
        });
        assert.equal((await enable.json()).data.isActive, true);

        const emptyQuery = await request("/api/v1/queries", {
            method: "POST", cookie: owner.cookie, csrf: owner.csrfToken, body: { question: "   " }
        });
        assert.equal(emptyQuery.status, 400);
        const failedQueryResponse = await request("/api/v1/queries", {
            method: "POST", cookie: owner.cookie, csrf: owner.csrfToken,
            body: { question: "Pregunta de integración sin proveedor RAG configurado" }
        });
        assert.equal(failedQueryResponse.status, 202);
        const failedQuery = (await failedQueryResponse.json()).data;
        assert.equal(failedQuery.status, "Error");
        queryIds.push(failedQuery.id);

        const hiddenFromOther = await request(`/api/v1/queries/${failedQuery.id}`, { cookie: other.cookie });
        assert.equal(hiddenFromOther.status, 404);
        const hiddenHistory = await request(`/api/v1/students/${owner.id}/history`, { cookie: other.cookie });
        assert.equal(hiddenHistory.status, 404);

        const noResultQueryId = await insertPendingQuery(owner.id, "Query para callback Sin resultados");
        const answeredQueryId = await insertPendingQuery(owner.id, "Query para callback Respondida");
        const callbackSecret = process.env.N8N_CALLBACK_SECRET;
        assert.ok(callbackSecret, "N8N_CALLBACK_SECRET debe estar configurado en el entorno local");
        const noResultsBody = { queryId: noResultQueryId, status: "Sin resultados" };
        const unauthorized = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": "incorrect-secret" }, body: noResultsBody
        });
        assert.equal(unauthorized.status, 401);
        const noResults = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: noResultsBody
        });
        assert.equal(noResults.status, 202);
        const repeatedNoResults = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: noResultsBody
        });
        assert.equal(repeatedNoResults.status, 200);

        const errorQueryId = await insertPendingQuery(owner.id, "Query para callback Error");
        const errorBody = { queryId: errorQueryId, status: "Error", errorCode: "N8N_PROCESSING_ERROR" };
        const errorCallback = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: errorBody
        });
        assert.equal(errorCallback.status, 202);
        const savedError = await (await request(`/api/v1/queries/${errorQueryId}`, { cookie: owner.cookie })).json();
        assert.equal(savedError.data.status, "Error");
        assert.equal(savedError.data.errorCode, "N8N_PROCESSING_ERROR");
        const repeatedError = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: errorBody
        });
        assert.equal(repeatedError.status, 200);

        const answeredBody = {
            queryId: answeredQueryId,
            status: "Respondida",
            answer: "Respuesta basada en los cursos sintéticos activos.",
            summary: "Tres cursos de integración.",
            explanation: "La prueba utiliza solo fuentes activas enviadas en el callback.",
            sources: courses.map((course, index) => ({ courseId: course.id, similarity: 0.9 - index / 20 }))
        };
        const answeredCallback = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: answeredBody
        });
        assert.equal(answeredCallback.status, 202);
        const savedAnswer = await (await request(`/api/v1/queries/${answeredQueryId}`, { cookie: owner.cookie })).json();
        assert.equal(savedAnswer.data.status, "Respondida");
        assert.equal(savedAnswer.data.sources.length, 3);

        const extraCourse = await pool.query(
            `INSERT INTO courses (name, description, category, level, duration_hours)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [`RutaIA Integration ${suffix} constraint`, "Fixture de prueba de constraint SQL.", `Integration-${suffix}`, "Básico", 1]
        );
        courseIds.push(extraCourse.rows[0].id);
        for (const score of ["NaN", "Infinity", "-Infinity"]) {
            await assert.rejects(
                pool.query(
                    `INSERT INTO recommendation_sources (recommendation_id, course_id, similarity_score, position)
                     VALUES ($1, $2, $3::numeric, 4)`,
                    [savedAnswer.data.recommendationId, extraCourse.rows[0].id, score]
                ),
                (error) => error.code === "23514" && error.constraint === "recommendation_sources_similarity_score_finite_check"
            );
        }

        const inactiveSourceQueryId = await insertPendingQuery(owner.id, "Query con una fuente desactivada");
        await pool.query("UPDATE courses SET is_active = FALSE WHERE id = $1", [courses[2].id]);
        const inactiveSourceBody = {
            ...answeredBody,
            queryId: inactiveSourceQueryId
        };
        const inactiveSourceCallback = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: inactiveSourceBody
        });
        assert.equal(inactiveSourceCallback.status, 202);
        const rejectedInactiveSources = await (await request(`/api/v1/queries/${inactiveSourceQueryId}`, { cookie: owner.cookie })).json();
        assert.equal(rejectedInactiveSources.data.status, "Error");
        assert.equal(rejectedInactiveSources.data.errorCode, "N8N_INVALID_SOURCES");
        assert.equal(rejectedInactiveSources.data.recommendationId, null);
        await pool.query("UPDATE courses SET is_active = TRUE WHERE id = $1", [courses[2].id]);
        const repeatedInactiveSourceCallback = await request("/api/v1/internal/n8n/results", {
            method: "POST", headers: { "X-N8N-Callback-Secret": callbackSecret }, body: inactiveSourceBody
        });
        assert.equal(repeatedInactiveSourceCallback.status, 200);

        const ratingUrl = `/api/v1/recommendations/${savedAnswer.data.recommendationId}/rating`;
        const otherStudentRating = await request(ratingUrl, {
            method: "POST", cookie: other.cookie, csrf: other.csrfToken, body: { score: 1, comment: "No pertenece a esta recomendación" }
        });
        assert.equal(otherStudentRating.status, 404);
        assert.equal((await otherStudentRating.json()).error.code, "RECOMMENDATION_NOT_FOUND");
        const rating = await request(ratingUrl, {
            method: "POST", cookie: owner.cookie, csrf: owner.csrfToken, body: { score: 5, comment: "Integración" }
        });
        assert.equal(rating.status, 201);
        const duplicateRating = await request(ratingUrl, {
            method: "POST", cookie: owner.cookie, csrf: owner.csrfToken, body: { score: 4 }
        });
        assert.equal(duplicateRating.status, 409);

        const statsResponse = await request("/api/v1/admin/statistics", { cookie: admin.cookie });
        assert.equal(statsResponse.status, 200);
        const stats = (await statsResponse.json()).data;
        assert.equal(stats.totalQueries, 5);
        assert.equal(stats.answeredQueries, 1);
        assert.equal(stats.noResultQueries, 1);
        assert.equal(stats.averageRating, 5);
        assert.equal(stats.mostRecommendedCourse.recommendation_count, 1);
    } finally {
        try {
            await cleanup();
            const remaining = await pool.query(
                "SELECT (SELECT count(*) FROM students)::int + (SELECT count(*) FROM courses)::int + (SELECT count(*) FROM queries)::int + (SELECT count(*) FROM recommendations)::int + (SELECT count(*) FROM ratings)::int AS count"
            );
            assert.equal(remaining.rows[0].count, 0, "La base aislada debe quedar vacía después de la integración");
        } catch (error) {
            cleanupError = error;
        }
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        await pool.end();
        if (cleanupError) throw cleanupError;
    }
});
