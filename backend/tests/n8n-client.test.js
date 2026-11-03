const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { startQuery } = require("../src/integrations/n8n/client");

const configuredValues = {
    N8N_QUERY_WEBHOOK_URL: "http://n8n.test/webhook/rutaia-query",
    N8N_WEBHOOK_SECRET: "x".repeat(32),
    N8N_CALLBACK_URL: "http://backend.test/api/v1/internal/n8n/results",
    N8N_CALLBACK_SECRET: "y".repeat(32),
    N8N_TIMEOUT_MS: 1000,
    OPENROUTER_EMBEDDING_MODEL: "test/embedding-model",
    OPENROUTER_CHAT_MODEL: "test/chat-model",
    QDRANT_URL: "http://qdrant.test:6333",
    QDRANT_COLLECTION: "rutaia-test-courses",
    RAG_MIN_SIMILARITY: 0.7
};

async function withMockedFetch(fetchMock, overrides, action) {
    const previousEnv = Object.fromEntries(Object.keys(configuredValues).map((key) => [key, env[key]]));
    const previousFetch = global.fetch;
    Object.assign(env, configuredValues, overrides);
    global.fetch = fetchMock;

    try {
        return await action();
    } finally {
        Object.assign(env, previousEnv);
        global.fetch = previousFetch;
    }
}

test("n8n client rejects incomplete webhook configuration before making a request", async () => {
    let called = false;
    await withMockedFetch(async () => { called = true; }, { N8N_WEBHOOK_SECRET: undefined }, async () => {
        await assert.rejects(startQuery({ queryId: "query-1" }), (error) => error.code === "N8N_NOT_CONFIGURED");
    });
    assert.equal(called, false);
});

test("n8n client rejects missing RAG configuration before making a request", async () => {
    let called = false;
    await withMockedFetch(async () => { called = true; }, { RAG_MIN_SIMILARITY: undefined }, async () => {
        await assert.rejects(startQuery({ queryId: "query-2" }), (error) => error.code === "RAG_CONFIGURATION_MISSING");
    });
    assert.equal(called, false);
});

test("n8n client maps a webhook timeout to a safe timeout code", async () => {
    const timeout = Object.assign(new Error("local timeout detail"), { name: "TimeoutError" });
    await withMockedFetch(async () => { throw timeout; }, {}, async () => {
        await assert.rejects(startQuery({ queryId: "query-3" }), (error) => {
            assert.equal(error.code, "N8N_TIMEOUT");
            assert.equal(error.message, "N8N_TIMEOUT");
            return true;
        });
    });
});

test("n8n client maps network failure to a safe unavailable code", async () => {
    await withMockedFetch(async () => { throw new Error("private network detail"); }, {}, async () => {
        await assert.rejects(startQuery({ queryId: "query-4" }), (error) => {
            assert.equal(error.code, "N8N_UNAVAILABLE");
            assert.equal(error.message, "N8N_UNAVAILABLE");
            return true;
        });
    });
});

test("n8n client rejects non-success HTTP responses without exposing response content", async () => {
    const fetchMock = async () => ({ ok: false, status: 401, text: async () => "private response body" });
    await withMockedFetch(fetchMock, {}, async () => {
        await assert.rejects(startQuery({ queryId: "query-5" }), (error) => {
            assert.equal(error.code, "N8N_HTTP_401");
            assert.equal(error.message, "N8N_REJECTED_REQUEST");
            assert.doesNotMatch(error.message, /private/);
            return true;
        });
    });
});

test("n8n client sends the authenticated minimal query and server-owned configuration", async () => {
    let request;
    await withMockedFetch(async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200 };
    }, {}, () => startQuery({ queryId: "query-6", question: "Pregunta de prueba" }));

    assert.equal(request.url, configuredValues.N8N_QUERY_WEBHOOK_URL);
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.authorization, `Bearer ${configuredValues.N8N_WEBHOOK_SECRET}`);
    assert.ok(request.options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(request.options.body), {
        queryId: "query-6",
        question: "Pregunta de prueba",
        callbackUrl: configuredValues.N8N_CALLBACK_URL,
        embeddingModel: configuredValues.OPENROUTER_EMBEDDING_MODEL,
        chatModel: configuredValues.OPENROUTER_CHAT_MODEL,
        minSimilarity: configuredValues.RAG_MIN_SIMILARITY,
        qdrantCollection: configuredValues.QDRANT_COLLECTION,
        qdrantUrl: configuredValues.QDRANT_URL
    });
});
