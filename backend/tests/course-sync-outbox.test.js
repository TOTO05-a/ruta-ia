const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pool = require("../src/db/pool");
const outbox = require("../src/repositories/course-sync-outbox.repository");
const incrementalWorkflow = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../../automation/n8n/sync-course-events.json"),
    "utf8"
));

test("claim usa bloqueo concurrente y devuelve una sola tarea para reintento durable", async () => {
    const originalQuery = pool.query;
    let captured;
    pool.query = async (sql, values) => {
        captured = { sql, values };
        return { rows: [{ id: "7", courseId: "course-uuid", action: "upsert", version: "2", payload: {} }] };
    };

    try {
        const events = await outbox.claimPending(1);
        assert.equal(events.length, 1);
        assert.match(captured.sql, /FOR UPDATE SKIP LOCKED/);
        assert.match(captured.sql, /locked_until = now\(\) \+ interval '5 minutes'/);
        assert.match(captured.sql, /attempts = attempts \+ 1/);
        assert.deepEqual(captured.values, [1]);
    } finally {
        pool.query = originalQuery;
    }
});

test("acknowledgement is conditional on the claimed event version", async () => {
    const originalQuery = pool.query;
    let captured;
    pool.query = async (sql, values) => {
        captured = { sql, values };
        return { rowCount: 0 };
    };

    try {
        assert.equal(await outbox.acknowledge("7", 3), false);
        assert.match(captured.sql, /WHERE id = \$1 AND version = \$2/);
        assert.deepEqual(captured.values, ["7", 3]);
    } finally {
        pool.query = originalQuery;
    }
});

test("migration enqueues only meaningful course changes and coalesces pending work", () => {
    const migration = fs.readFileSync(
        path.resolve(__dirname, "../../database/migrations/005_course_qdrant_sync_outbox.sql"),
        "utf8"
    );
    assert.match(migration, /UNIQUE/);
    assert.match(migration, /NEW\.name IS NOT DISTINCT FROM OLD\.name/);
    assert.match(migration, /version = course_qdrant_sync_outbox\.version \+ 1/);
    assert.match(migration, /sync_action := CASE WHEN NEW\.is_active THEN 'upsert' ELSE 'delete' END/);
    assert.match(migration, /AFTER INSERT OR UPDATE OF/);
});

test("incremental workflow skips empty polls and prepares one valid upsert for the configured collection", () => {
    const nodeCode = (name) => incrementalWorkflow.nodes.find((node) => node.name === name).parameters.jsCode;
    const unpack = new Function("$input", nodeCode("Desempaquetar evento"));
    assert.deepEqual(unpack({ first: () => ({ json: { data: { event: null } } }) }), []);

    const course = {
        id: "c104c90e-f460-4ae3-9056-281fb202c4c0",
        name: "Curso",
        description: "Descripción",
        category: "Técnica",
        level: "Básico",
        intecapCareerType: null,
        durationHours: 20
    };
    const event = { id: "8", action: "upsert", version: 1, payload: course };
    const config = {
        qdrantUrl: "http://qdrant:6333",
        collection: "rutaia_courses_openrouter_2048",
        dimension: 2048
    };
    const nodeContext = {
        "Leer configuración incremental": { data: config },
        "Desempaquetar evento": event
    };
    const resolver = (name) => ({ first: () => ({ json: nodeContext[name] }) });
    const validate = new Function("$input", "$", nodeCode("Validar punto incremental"));
    const result = validate(
        { first: () => ({ json: { embeddings: [Array(2048).fill(0.25)] } }) },
        resolver
    )[0].json;
    assert.equal(result.collection, "rutaia_courses_openrouter_2048");
    assert.equal(result.point.id, course.id);
    assert.equal(result.point.vector.length, 2048);
});

test("incremental workflow fails closed if the configured collection is not the new 2048-dimension target", () => {
    const code = incrementalWorkflow.nodes.find((node) => node.name === "Validar punto incremental").parameters.jsCode;
    const event = { id: "8", action: "upsert", version: 1, payload: { id: "course-id" } };
    const resolver = (name) => ({
        first: () => ({ json: name === "Leer configuración incremental"
            ? { data: { collection: "rutaia_courses", dimension: 1024, qdrantUrl: "http://qdrant:6333" } }
            : event })
    });
    const validate = new Function("$input", "$", code);
    assert.throws(
        () => validate({ first: () => ({ json: { embeddings: [Array(1024).fill(0.1)] } }) }, resolver),
        /Destino incremental no permitido/
    );
});
