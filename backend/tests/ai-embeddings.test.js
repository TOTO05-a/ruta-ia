const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { generate, validateEmbeddingInput } = require("../src/integrations/ai/embeddings");

async function withProvider(overrides, fetchMock, action) {
    const keys = ["OPENROUTER_API_KEY", "OPENROUTER_EMBEDDING_MODEL", "AI_EMBEDDING_TIMEOUT_MS"];
    const previousEnv = Object.fromEntries(keys.map((key) => [key, env[key]]));
    const previousFetch = global.fetch;
    Object.assign(env, {
        OPENROUTER_API_KEY: "test-api-key",
        OPENROUTER_EMBEDDING_MODEL: "nvidia/nemotron-3.5-embed-1b:free",
        AI_EMBEDDING_TIMEOUT_MS: 1000,
        ...overrides
    });
    global.fetch = fetchMock;
    try {
        return await action();
    } finally {
        Object.assign(env, previousEnv);
        global.fetch = previousFetch;
    }
}

test("proxy OpenRouter devuelve un embedding con la configuración del proveedor", async () => {
    let request;
    const result = await withProvider({}, async (url, options) => {
        request = { url, options };
        return {
            ok: true,
            json: async () => ({
                data: [{ index: 0, embedding: [1, 2] }]
            })
        };
    }, () => generate({ input: "curso de cocina" }));

    assert.equal(request.url, "https://openrouter.ai/api/v1/embeddings");
    assert.match(request.options.headers.authorization, /^Bearer /);
    assert.deepEqual(JSON.parse(request.options.body), {
        model: "nvidia/nemotron-3.5-embed-1b:free",
        input: ["curso de cocina"]
    });
    assert.deepEqual(result, { embeddings: [[1, 2]] });
});

test("proxy divide lotes grandes y conserva orden y dimensión entre sublotes", async () => {
    let requestCount = 0;
    await withProvider({}, async (_url, options) => {
        requestCount += 1;
        const inputs = JSON.parse(options.body).input;
        const offset = (requestCount - 1) * 2;
        return {
            ok: true,
            json: async () => ({
                data: inputs.map((_input, index) => ({ index, embedding: [offset + index, 1] }))
            })
        };
    }, async () => {
        const result = await generate({ input: Array.from({ length: 10 }, (_, index) => `texto ${index}`) });
        assert.equal(result.embeddings.length, 10);
        assert.deepEqual(result.embeddings[0], [0, 1]);
        assert.deepEqual(result.embeddings[1], [1, 1]);
        assert.deepEqual(result.embeddings[2], [2, 1]);
        assert.deepEqual(result.embeddings[9], [9, 1]);
        assert.equal(requestCount, 5);
    });
});

test("proxy reintenta individualmente si OpenRouter rechaza un lote", async () => {
    const requests = [];
    await withProvider({}, async (_url, options) => {
        const inputs = JSON.parse(options.body).input;
        requests.push(inputs);
        if (inputs.length > 1) return { ok: false, status: 400 };
        return {
            ok: true,
            json: async () => ({ data: [{ index: 0, embedding: [inputs[0].length, 1] }] })
        };
    }, async () => {
        const result = await generate({ input: ["uno", "dos"] });
        assert.deepEqual(result.embeddings, [[3, 1], [3, 1]]);
    });
    assert.deepEqual(requests, [["uno", "dos"], ["uno"], ["dos"]]);
});

test("proxy reintenta errores transitorios del proveedor y devuelve resultado al recuperarse", async () => {
    let requestCount = 0;
    await withProvider({}, async () => {
        requestCount += 1;
        if (requestCount === 1) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 2] }] }) };
    }, async () => {
        const result = await generate({ input: "texto sintético" });
        assert.deepEqual(result, { embeddings: [[1, 2]] });
    });
    assert.equal(requestCount, 2);
});

test("proxy no reintenta respuestas de límite de solicitudes", async () => {
    let requestCount = 0;
    await withProvider({}, async () => {
        requestCount += 1;
        return { ok: false, status: 429 };
    }, async () => {
        await assert.rejects(generate({ input: "texto sintético" }),
            (error) => error.code === "AI_PROVIDER_RATE_LIMITED");
    });
    assert.equal(requestCount, 1);
});

test("proxy rechaza lote vacío, elementos inválidos o exceso de tamaño antes de contactar", async () => {
    assert.throws(() => validateEmbeddingInput({ input: [] }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    assert.throws(() => validateEmbeddingInput({ input: ["válido", "  "] }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    assert.throws(() => validateEmbeddingInput({ input: ["x".repeat(500_001)] }),
        (error) => error.code === "AI_EMBEDDING_INPUT_TOO_LARGE");

    let called = false;
    await withProvider({}, async () => { called = true; }, async () => {
        await assert.rejects(generate({ input: [] }), (error) => error.code === "AI_EMBEDDING_INVALID_INPUT");
    });
    assert.equal(called, false);
});

test("proxy retorna error explícito si falta la clave sin filtrar ni llamar al proveedor", async () => {
    let called = false;
    await withProvider({ OPENROUTER_API_KEY: "" }, async () => { called = true; }, async () => {
        await assert.rejects(generate({ input: "consulta de prueba" }), (error) => {
            assert.equal(error.code, "AI_PROVIDER_NOT_CONFIGURED");
            assert.doesNotMatch(error.message, /key|token/i);
            return true;
        });
    });
    assert.equal(called, false);
});

test("proxy rechaza respuestas incompletas, desordenadas o con dimensiones inconsistentes", async () => {
    const invalidResponses = [
        { data: [] },
        { data: [{ index: 1, embedding: [1, 2] }] },
        { data: [{ index: 0.5, embedding: [1, 2] }] },
        { data: [{ index: 0, embedding: [] }] },
        { data: [{ index: 0, embedding: [1, NaN] }] }
    ];

    for (const body of invalidResponses) {
        await withProvider({}, async () => ({ ok: true, json: async () => body }), async () => {
            await assert.rejects(generate({ input: "uno" }),
                (error) => error.code === "AI_PROVIDER_INVALID_RESPONSE");
        });
    }
});

test("proxy rechaza dimensiones distintas entre solicitudes de un lote", async () => {
    await withProvider({}, async (_url, options) => {
        const inputs = JSON.parse(options.body).input;
        return {
            ok: true,
            json: async () => ({
                data: inputs.map((_input, index) => ({ index, embedding: index === 0 ? [1, 2] : [1, 2, 3] }))
            })
        };
    }, async () => {
        await assert.rejects(generate({ input: ["uno", "dos"] }),
            (error) => error.code === "AI_PROVIDER_INVALID_RESPONSE");
    });
});

test("proxy no expone el cuerpo de error devuelto por OpenRouter", async () => {
    await withProvider({}, async () => ({ ok: false, status: 401, text: async () => "secret provider detail" }), async () => {
        await assert.rejects(generate({ input: "consulta de prueba" }), (error) => {
            assert.equal(error.code, "AI_PROVIDER_REJECTED_REQUEST");
            assert.doesNotMatch(error.message, /secret provider detail/);
            return true;
        });
    });
});
