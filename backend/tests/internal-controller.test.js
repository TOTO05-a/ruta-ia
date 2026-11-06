const assert = require("node:assert/strict");
const test = require("node:test");
const env = require("../src/config/env");
const controller = require("../src/controllers/internal.controller");

function response() {
    return {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

test("index config only exposes the Gemini collection and model", async () => {
    const previous = {
        GEMINI_EMBEDDING_MODEL: env.GEMINI_EMBEDDING_MODEL,
        QDRANT_URL: env.QDRANT_URL,
        QDRANT_COLLECTION: env.QDRANT_COLLECTION
    };

    try {
        env.GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
        env.QDRANT_URL = "http://qdrant.test:6333";

        env.QDRANT_COLLECTION = "rutaia_courses";
        const legacyResponse = response();
        await controller.indexingConfig({ requestId: "request-1" }, legacyResponse);
        assert.equal(legacyResponse.statusCode, 503);
        assert.equal(legacyResponse.body.error.code, "INDEXING_NOT_CONFIGURED");

        env.QDRANT_COLLECTION = "rutaia_courses_gemini_1536";
        const validResponse = response();
        await controller.indexingConfig({ requestId: "request-2" }, validResponse);
        assert.equal(validResponse.statusCode, 200);
        assert.equal(validResponse.body.data.collection, "rutaia_courses_gemini_1536");
        assert.equal(validResponse.body.data.embeddingModel, "gemini-embedding-2");
    } finally {
        Object.assign(env, previous);
    }
});

test("configuración de sincronización fija la nueva dimensión Gemini", async () => {
    const previous = { GEMINI_EMBEDDING_MODEL: env.GEMINI_EMBEDDING_MODEL, QDRANT_URL: env.QDRANT_URL, QDRANT_COLLECTION: env.QDRANT_COLLECTION };
    try {
        env.GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
        env.QDRANT_URL = "http://qdrant.test:6333";
        env.QDRANT_COLLECTION = "rutaia_courses_gemini_1536";
        const result = response();
        await controller.courseSyncConfig({ requestId: "request-3" }, result);
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.data.collection, "rutaia_courses_gemini_1536");
        assert.equal(result.body.data.dimension, 1536);
    } finally { Object.assign(env, previous); }
});
