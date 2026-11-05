const test = require("node:test");
const assert = require("node:assert/strict");

const controller = require("../src/controllers/query.controller");
const n8n = require("../src/integrations/n8n/client");
const pool = require("../src/db/pool");
const repository = require("../src/repositories/query.repository");
const service = require("../src/services/query.service");
const { toCsv } = require("../src/utils/csv");
const { createQuerySchema } = require("../src/validators/query.validators");

test("query input accepts optional category and level filters and rejects invalid values", () => {
    assert.equal(createQuerySchema.safeParse({ question: "Aprender programación" }).success, true);
    assert.equal(createQuerySchema.safeParse({
        question: "Aprender programación",
        category: "Desarrollo web",
        level: "Intermedio"
    }).success, true);
    assert.equal(createQuerySchema.safeParse({ question: "Pregunta", level: "Experto" }).success, false);
    assert.equal(createQuerySchema.safeParse({ question: "Pregunta", category: "x".repeat(101) }).success, false);
    assert.equal(createQuerySchema.safeParse({ question: "Pregunta", unexpected: true }).success, false);
});

test("query creation sends only the authenticated student's latest three answered turns", async () => {
    const originals = {
        recent: repository.listRecentAnsweredByStudent,
        create: repository.create,
        get: repository.getById,
        startQuery: n8n.startQuery
    };
    const history = [1, 2, 3, 4].map((number) => ({ question: `Pregunta ${number}`, answer: `Respuesta ${number}` }));
    let capturedPayload;
    try {
        repository.listRecentAnsweredByStudent = async (studentId) => {
            assert.equal(studentId, "student-owner");
            return history;
        };
        repository.create = async (studentId, question) => {
            assert.equal(studentId, "student-owner");
            return { id: "query-new", question, status: "Pendiente" };
        };
        repository.getById = async () => ({ id: "query-new", question: "Nueva pregunta", status: "Pendiente" });
        n8n.startQuery = async (payload) => { capturedPayload = payload; };

        await service.create({
            id: "student-owner",
            experience_level: "Principiante",
            interest_area: "Desarrollo web"
        }, {
            question: "Nueva pregunta",
            category: "Desarrollo web",
            level: "Básico"
        });
    } finally {
        repository.listRecentAnsweredByStudent = originals.recent;
        repository.create = originals.create;
        repository.getById = originals.get;
        n8n.startQuery = originals.startQuery;
    }

    assert.deepEqual(capturedPayload.conversationHistory, history.slice(-3));
    assert.equal(capturedPayload.category, "Desarrollo web");
    assert.equal(capturedPayload.level, "Básico");
    assert.equal(capturedPayload.question, "Nueva pregunta");
});

test("recent memory repository is limited to answered queries owned by the requesting student", async () => {
    const originalQuery = pool.query;
    let captured;
    pool.query = async (sql, values) => {
        captured = { sql, values };
        return { rows: [{ question: "anterior", answer: "respuesta" }] };
    };
    try {
        const rows = await repository.listRecentAnsweredByStudent("student-owner");
        assert.deepEqual(rows, [{ question: "anterior", answer: "respuesta" }]);
    } finally {
        pool.query = originalQuery;
    }
    assert.deepEqual(captured.values, ["student-owner", 3]);
    assert.match(captured.sql, /q\.student_id = \$1 AND q\.status = 'Respondida'/);
    assert.match(captured.sql, /LIMIT \$2/);
});

test("CSV escaping quotes cells and neutralizes spreadsheet formulas", () => {
    const csv = toCsv([{
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
        status: "Respondida",
        question: '=HYPERLINK("https://example.test","abrir")',
        answer: "respuesta",
        summary: null,
        explanation: "línea 1\r\nlínea 2",
        sources: "@SUM(1,1)"
    }]);

    assert.match(csv, /"'\=HYPERLINK\(""https:\/\/example\.test"",""abrir""\)"/);
    assert.match(csv, /"'\@SUM\(1,1\)"/);
    assert.match(csv, /"línea 1\r\nlínea 2"/);
    assert.match(csv, /^\uFEFF"Fecha","Estado"/);
});

test("CSV export contract reads only the authenticated student's saved history", async () => {
    const originalExport = service.exportHistory;
    let requestedStudent;
    let responseBody;
    let responseType;
    let disposition;
    service.exportHistory = async (studentId) => {
        requestedStudent = studentId;
        return [{ createdAt: "2026-01-01", question: "Mi consulta", status: "Pendiente" }];
    };
    const response = {
        status(code) { assert.equal(code, 200); return this; },
        type(value) { responseType = value; return this; },
        attachment(value) { disposition = value; return this; },
        send(value) { responseBody = value; return this; }
    };
    try {
        await controller.exportHistory({ auth: { id: "student-owner" } }, response);
    } finally {
        service.exportHistory = originalExport;
    }

    assert.equal(requestedStudent, "student-owner");
    assert.equal(responseType, "text/csv");
    assert.equal(disposition, "historial-rutaia.csv");
    assert.match(responseBody, /"Mi consulta"/);
});

test("history export query scopes all returned records to the authenticated student", async () => {
    const originalQuery = pool.query;
    let captured;
    pool.query = async (sql, values) => {
        captured = { sql, values };
        return { rows: [] };
    };
    try {
        assert.deepEqual(await repository.listHistoryForExport("student-owner"), []);
    } finally {
        pool.query = originalQuery;
    }

    assert.deepEqual(captured.values, ["student-owner"]);
    assert.match(captured.sql, /WHERE q\.student_id = \$1/);
    assert.match(captured.sql, /ORDER BY q\.created_at DESC/);
});
