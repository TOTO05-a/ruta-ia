const assert = require("node:assert/strict");
const test = require("node:test");

const originalEnvironment = {
    RUTAIA_API_URL: process.env.RUTAIA_API_URL,
    N8N_COURSE_SYNC_SECRET: process.env.N8N_COURSE_SYNC_SECRET
};
process.env.RUTAIA_API_URL = "http://calibration.test/api/v1";
process.env.N8N_COURSE_SYNC_SECRET = "test-sync-secret";
const { embed, readMinimumSimilarity } = require("../scripts/calibrate-rag-threshold");
for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}

test("calibration forwards the query task to the embedding proxy in every batch", async () => {
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        return {
            ok: true,
            json: async () => ({ embeddings: JSON.parse(options.body).input.map(() => [1, 0]) })
        };
    };

    try {
        const vectors = await embed(["pregunta uno", "pregunta dos", "pregunta tres"], "query");

        assert.deepEqual(vectors, [[1, 0], [1, 0], [1, 0]]);
        assert.equal(requests.length, 2);
        assert.ok(requests.every(({ url }) => url === "http://calibration.test/api/v1/internal/ai/embeddings"));
        assert.ok(requests.every(({ options }) => options.headers["x-n8n-sync-secret"] === "test-sync-secret"));
        assert.ok(requests.every(({ body }) => body.task === "query"));
        assert.deepEqual(requests.map(({ body }) => body.input.length), [2, 1]);
    } finally {
        global.fetch = originalFetch;
    }
});

test("calibration does not reuse an old threshold when none is configured", () => {
    assert.equal(readMinimumSimilarity(undefined), null);
    assert.equal(readMinimumSimilarity(""), null);
    assert.equal(readMinimumSimilarity("0.62"), 0.62);
    assert.throws(() => readMinimumSimilarity("1.1"), /entre -1 y 1/);
});
