const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { generate, validateEmbeddingInput } = require("../src/integrations/ai/embeddings");

const vector = (fill = 0.25) => Array(1536).fill(fill);

async function withProvider(overrides, fetchMock, action) {
    const keys = ["GEMINI_API_KEY", "GEMINI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_DIMENSIONS", "AI_EMBEDDING_TIMEOUT_MS"];
    const previousEnv = Object.fromEntries(keys.map((key) => [key, env[key]]));
    const previousFetch = global.fetch;
    Object.assign(env, { GEMINI_API_KEY: "test-api-key", GEMINI_EMBEDDING_MODEL: "gemini-embedding-2", GEMINI_EMBEDDING_DIMENSIONS: 1536, AI_EMBEDDING_TIMEOUT_MS: 1000, ...overrides });
    global.fetch = fetchMock;
    try { return await action(); }
    finally { Object.assign(env, previousEnv); global.fetch = previousFetch; }
}

test("Gemini crea embedding documental de 1536 dimensiones con encabezado de tarea", async () => {
    let request;
    const result = await withProvider({}, async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ embedding: { values: vector() } }) };
    }, () => generate({ input: "curso de cocina", task: "document" }));

    assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent");
    assert.equal(request.options.headers["x-goog-api-key"], "test-api-key");
    assert.deepEqual(JSON.parse(request.options.body), {
        content: { parts: [{ text: "title: none | text: curso de cocina" }] }, outputDimensionality: 1536
    });
    assert.deepEqual(result, { embeddings: [vector()] });
});

test("Gemini prefija consultas con la instrucción de recuperación de respuestas", async () => {
    let body;
    await withProvider({}, async (_url, options) => {
        body = JSON.parse(options.body);
        return { ok: true, json: async () => ({ embedding: { values: vector() } }) };
    }, () => generate({ input: "quiero aprender gastronomía", task: "query" }));
    assert.equal(body.content.parts[0].text, "task: question answering | query: quiero aprender gastronomía");
});

test("proxy divide lotes y conserva el orden y la dimensión", async () => {
    let requestCount = 0;
    await withProvider({}, async (_url, options) => {
        requestCount += 1;
        const content = JSON.parse(options.body).content.parts[0].text;
        const index = Number(content.match(/texto (\d+)/)?.[1] ?? 0);
        return { ok: true, json: async () => ({ embedding: { values: vector(index) } }) };
    }, async () => {
        const result = await generate({ input: Array.from({ length: 10 }, (_, index) => `texto ${index}`) });
        assert.equal(result.embeddings.length, 10);
        assert.deepEqual(result.embeddings.map((item) => item[0]), Array.from({ length: 10 }, (_, index) => index));
        assert.equal(requestCount, 10);
    });
});

test("proxy reintenta errores 5xx y no reintenta el límite de cuota", async () => {
    let requestCount = 0;
    await withProvider({}, async () => {
        requestCount += 1;
        if (requestCount === 1) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ embedding: { values: vector() } }) };
    }, () => generate({ input: "texto sintético" }));
    assert.equal(requestCount, 2);

    requestCount = 0;
    await withProvider({}, async () => { requestCount += 1; return { ok: false, status: 429 }; }, async () => {
        await assert.rejects(generate({ input: "texto sintético" }), (error) => error.code === "AI_PROVIDER_RATE_LIMITED");
    });
    assert.equal(requestCount, 1);
});

test("proxy rechaza entradas o tareas no válidas antes de llamar al proveedor", async () => {
    assert.throws(() => validateEmbeddingInput({ input: [] }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    assert.throws(() => validateEmbeddingInput({ input: ["válido", "  "] }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    assert.throws(() => validateEmbeddingInput({ input: ["x".repeat(500_001)] }), (error) => error.code === "AI_EMBEDDING_INPUT_TOO_LARGE");
    let called = false;
    await withProvider({}, async () => { called = true; }, async () => {
        await assert.rejects(generate({ input: "texto", task: "otra" }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    });
    assert.equal(called, false);
});

test("proxy requiere clave y rechaza respuestas con dimensión inesperada", async () => {
    await withProvider({ GEMINI_API_KEY: "" }, async () => assert.fail("no debe llamar al proveedor"), async () => {
        await assert.rejects(generate({ input: "texto" }), (error) => error.code === "AI_PROVIDER_NOT_CONFIGURED");
    });
    await withProvider({}, async () => ({ ok: true, json: async () => ({ embedding: { values: [1, 2] } }) }), async () => {
        await assert.rejects(generate({ input: "texto" }), (error) => error.code === "AI_PROVIDER_INVALID_RESPONSE");
    });
});

test("proxy no expone el cuerpo de error devuelto por Gemini", async () => {
    await withProvider({}, async () => ({ ok: false, status: 401, text: async () => "secret provider detail" }), async () => {
        await assert.rejects(generate({ input: "consulta" }), (error) => {
            assert.equal(error.code, "AI_PROVIDER_REJECTED_REQUEST");
            assert.doesNotMatch(error.message, /secret provider detail/);
            return true;
        });
    });
});
