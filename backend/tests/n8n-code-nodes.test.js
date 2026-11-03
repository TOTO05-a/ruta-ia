const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const workflowDirectory = path.resolve(__dirname, "../../automation/n8n");
const answerWorkflow = JSON.parse(fs.readFileSync(path.join(workflowDirectory, "answer-query.json"), "utf8"));
const indexWorkflow = JSON.parse(fs.readFileSync(path.join(workflowDirectory, "index-courses.json"), "utf8"));

function codeNode(workflow, name) {
    const node = workflow.nodes.find((candidate) => candidate.name === name);
    assert.ok(node, `No existe el nodo ${name}`);
    assert.equal(node.type, "n8n-nodes-base.code");
    return node.parameters.jsCode;
}

function executeCode(source, nodeData, input) {
    const wrapped = new vm.Script(`(function $(name) { return { first: () => ({ json: nodeData[name] }) }; })`);
    const lookup = wrapped.runInNewContext({ nodeData });
    const fn = new vm.Script(`(function ($, $input) { ${source}\n})`).runInNewContext();
    const result = fn(lookup, { first: () => ({ json: input }) });
    const normalized = JSON.parse(JSON.stringify(result));
    return normalized.map((item) => item.json);
}

function course(id, overrides = {}) {
    return {
        id,
        name: `Curso ${id}`,
        description: `Descripción ${id}`,
        category: "Desarrollo web",
        level: "Básico",
        intecapCareerType: null,
        durationHours: 20,
        ...overrides
    };
}

function hit(courseId, score) {
    return { payload: { course_id: courseId }, score };
}

test("workflow RAG limita la generación local a una salida JSON manejable", () => {
    const node = answerWorkflow.nodes.find((candidate) => candidate.name === "Generar respuesta grounded");
    assert.ok(node, "Existe el nodo de generación grounded");
    assert.match(node.parameters.jsonBody, /options: \{ temperature: 0\.2, num_predict: 512 \}/);
});

test("workflow RAG prepara el embedding con la configuración enviada por Express", () => {
    const node = codeNode(answerWorkflow, "Preparar embedding de pregunta");
    const request = {
        queryId: "query-embedding",
        question: "Me interesa cocina y gastronomía",
        experienceLevel: "Principiante",
        interestArea: "Gastronomía",
        embeddingModel: "bge-m3",
        chatModel: "qwen2.5:3b",
        ollamaBaseUrl: "http://host.docker.internal:11434",
        minSimilarity: 0.5,
        qdrantCollection: "rutaia_courses",
        qdrantUrl: "http://qdrant:6333",
        callbackUrl: "http://backend:3000/api/v1/internal/n8n/results"
    };
    const context = { "Webhook autenticado de consulta": { body: request } };

    assert.deepEqual(executeCode(node, context, {}), [{
        model: "bge-m3",
        input: "Me interesa cocina y gastronomía",
        ollamaBaseUrl: "http://host.docker.internal:11434"
    }]);
    assert.throws(() => executeCode(node, {
        "Webhook autenticado de consulta": { body: { ...request, callbackUrl: undefined } }
    }, {}), /Payload de consulta incompleto/);
});

test("workflow RAG selecciona solo cursos activos únicos sobre el umbral", () => {
    const node = codeNode(answerWorkflow, "Filtrar fuentes activas y umbral");
    const request = {
        queryId: "query-1",
        question: "¿Cómo empiezo desarrollo web?",
        minSimilarity: 0.7
    };
    const activeCourses = [course("active-a", { intecapCareerType: "CTM" }), course("active-b"), course("active-c")];
    const result = executeCode(node, {
        "Webhook autenticado de consulta": { body: request },
        "Leer catálogo activo PostgreSQL": { data: { items: activeCourses } }
    }, {
        result: { points: [
            hit("inactive", 0.99),
            hit("active-a", 0.8),
            hit("active-a", 0.95),
            hit("active-b", 0.69),
            hit("active-b", 0.75),
            hit("active-c", 0.7)
        ] }
    });

    assert.equal(result[0].status, "Respondida");
    assert.deepEqual(result[0].sources.map((source) => source.courseId), ["active-a", "active-b", "active-c"]);
    assert.deepEqual(result[0].sources.map((source) => source.similarity), [0.8, 0.75, 0.7]);
    assert.equal(result[0].sources[0].intecapCareerType, "CTM");
    assert.match(result[0].context, /Curso active-a/);
    assert.match(result[0].context, /Clasificación INTECAP: CTM/);
    assert.doesNotMatch(result[0].context, /inactive/);
});

test("workflow RAG devuelve Sin resultados con menos de tres fuentes elegibles", () => {
    const node = codeNode(answerWorkflow, "Filtrar fuentes activas y umbral");
    const result = executeCode(node, {
        "Webhook autenticado de consulta": { body: { queryId: "query-2", minSimilarity: 0.8 } },
        "Leer catálogo activo PostgreSQL": { data: { items: [course("one"), course("two")] } }
    }, { result: { points: [hit("one", 0.9), hit("two", 0.4)] } });

    assert.deepEqual(result, [{ queryId: "query-2", status: "Sin resultados" }]);
});

test("workflow RAG ordena por score y limita las fuentes a cinco", () => {
    const node = codeNode(answerWorkflow, "Filtrar fuentes activas y umbral");
    const courses = Array.from({ length: 7 }, (_, index) => course(`course-${index}`));
    const points = courses.map((item, index) => hit(item.id, 0.7 + index / 100));
    const result = executeCode(node, {
        "Webhook autenticado de consulta": { body: { queryId: "query-3", minSimilarity: 0.7 } },
        "Leer catálogo activo PostgreSQL": { data: { items: courses } }
    }, { result: { points } });

    assert.equal(result[0].sources.length, 5);
    assert.deepEqual(result[0].sources.map((source) => source.courseId), ["course-6", "course-5", "course-4", "course-3", "course-2"]);
});

test("workflow RAG valida el JSON estructurado de Ollama antes del callback", () => {
    const node = codeNode(answerWorkflow, "Validar callback de recomendación");
    const context = {
        "Webhook autenticado de consulta": { body: { queryId: "query-json" } },
        "Filtrar fuentes activas y umbral": { sources: [
            { courseId: "a", similarity: 0.82 },
            { courseId: "b", similarity: 0.76 },
            { courseId: "c", similarity: 0.71 }
        ] }
    };
    const valid = executeCode(node, context, {
        message: { content: JSON.stringify({ answer: "Respuesta", summary: "Resumen", explanation: "Explicación" }) }
    });
    assert.equal(valid[0].status, "Respondida");
    assert.equal(valid[0].queryId, "query-json");
    assert.equal(valid[0].sources.length, 3);
    assert.throws(() => executeCode(node, context, { message: { content: "no es json" } }), /JSON|Unexpected/);
    assert.throws(() => executeCode(node, context, { message: { content: JSON.stringify({ answer: "Respuesta" }) } }), /Respuesta RAG incompleta/);
});

test("indexación conserva asociación por índice y valida dimensión y valores finitos", () => {
    const node = codeNode(indexWorkflow, "Validar y preparar puntos Qdrant");
    const courses = [course("course-a", { intecapCareerType: "CTO" }), course("course-b")];
    const context = {
        "Preparar textos de cursos": {
            qdrantUrl: "http://qdrant:6333/",
            collection: "rutaia-courses",
            courses
        }
    };
    const result = executeCode(node, context, {
        embeddings: [[1, 0, 0], [0, 1, 0]]
    });

    assert.equal(result[0].qdrantUrl, "http://qdrant:6333");
    assert.equal(result[0].dimension, 3);
    assert.deepEqual(result[0].points.map((point) => point.id), ["course-a", "course-b"]);
    assert.deepEqual(result[0].points.map((point) => point.vector), [[1, 0, 0], [0, 1, 0]]);
    assert.deepEqual(result[0].points.map((point) => point.payload.course_id), ["course-a", "course-b"]);
    assert.deepEqual(result[0].points.map((point) => point.payload.intecap_career_type), ["CTO", null]);

    assert.throws(() => executeCode(node, context, { embeddings: [[1, 0, 0]] }), /cantidad de embeddings inválida/);
    assert.throws(() => executeCode(node, context, { embeddings: [[1, 0], [0, 1, 0]] }), /dimensión o valores válidos/);
    assert.throws(() => executeCode(node, context, { embeddings: [[1, Number.NaN, 0], [0, 1, 0]] }), /dimensión o valores válidos/);
});

test("indexación vacía conserva el contexto y limpia vectores obsoletos sin ocultar fallos", () => {
    const prepare = codeNode(indexWorkflow, "Preparar textos de cursos");
    const context = {
        "Leer configuración de indexación": { data: { qdrantUrl: "http://qdrant:6333", collection: "rutaia_courses" } },
        "Leer catálogo PostgreSQL": { data: { items: [] } }
    };
    const prepared = executeCode(prepare, context, {});
    assert.equal(prepared.length, 1);
    assert.equal(prepared[0].emptyCatalog, true);
    assert.deepEqual(prepared[0].courses, []);
    assert.deepEqual(prepared[0].inputs, []);

    const cleanup = codeNode(indexWorkflow, "Validar limpieza del catálogo vacío");
    assert.deepEqual(executeCode(cleanup, {}, { statusCode: 200, body: { result: { status: "completed" } } }), [
        { cleared: true }
    ]);
    assert.deepEqual(executeCode(cleanup, {}, { statusCode: 404, body: { status: { error: "Not found" } } }), [
        { cleared: false, reason: "collection_not_created" }
    ]);
    assert.throws(() => executeCode(cleanup, {}, { statusCode: 503 }), /Qdrant no pudo limpiar/);
});
