const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { generate } = require("../src/integrations/ai/chat");

async function withProvider(overrides, fetchMock, action) {
    const keys = ["AI_PROVIDER", "AI_CHAT_TIMEOUT_MS", "OPENROUTER_API_KEY", "OPENROUTER_CHAT_MODEL", "OLLAMA_BASE_URL", "OLLAMA_CHAT_MODEL"];
    const prior = Object.fromEntries(keys.map((key) => [key, env[key]]));
    const priorFetch = global.fetch;
    Object.assign(env, { AI_CHAT_TIMEOUT_MS: 1000, OLLAMA_BASE_URL: "http://ollama.test:11434", OLLAMA_CHAT_MODEL: "qwen2.5:3b", ...overrides });
    global.fetch = fetchMock;
    try { return await action(); }
    finally { Object.assign(env, prior); global.fetch = priorFetch; }
}

const validBody = {
    format: { type: "object", required: ["answer", "summary", "explanation"] },
    options: { temperature: 0.2, num_predict: 192 },
    messages: [{ role: "system", content: "Responde solo con los cursos indicados." }, { role: "user", content: "Busco gastronomía." }]
};

test("OpenRouter usa solo el router gratuito y normaliza la respuesta sin exponer la clave", async () => {
    let request;
    await withProvider({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret-test-key", OPENROUTER_CHAT_MODEL: "openrouter/free" },
        async (url, options) => {
            request = { url, options };
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ answer: "Cursos encontrados", summary: "Resumen", explanation: "Fuentes" }) } }] }) };
        }, async () => {
            const result = await generate(validBody);
            assert.match(result.message.content, /Cursos encontrados/);
            assert.equal(JSON.parse(result.message.content).summary, "Resumen");
        });

    assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(request.options.headers.authorization, "Bearer secret-test-key");
    const body = JSON.parse(request.options.body);
    assert.equal(body.model, "openrouter/free");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.max_tokens, 192);
    assert.equal(Object.hasOwn(body, "api_key"), false);
});

test("Ollama permanece como alternativa local con el formato nativo", async () => {
    let request;
    await withProvider({ AI_PROVIDER: "ollama" }, async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ message: { content: JSON.stringify({ answer: "Respuesta local", summary: "Resumen", explanation: "Fuentes" }) } }) };
    }, async () => {
        const result = await generate(validBody);
        assert.match(result.message.content, /Respuesta local/);
    });

    assert.equal(request.url, "http://ollama.test:11434/api/chat");
    const body = JSON.parse(request.options.body);
    assert.equal(body.model, "qwen2.5:3b");
    assert.deepEqual(body.format, validBody.format);
    assert.equal(request.options.headers.authorization, undefined);
});

test("proxy rechaza mensajes malformados antes de contactar al proveedor", async () => {
    let called = false;
    await withProvider({ AI_PROVIDER: "ollama" }, async () => { called = true; }, async () => {
        await assert.rejects(generate({ messages: [{ role: "developer", content: "x" }] }), (error) => error.code === "AI_CHAT_INVALID_INPUT");
    });
    assert.equal(called, false);
});

test("el error del proveedor no filtra detalles ni claves", async () => {
    await withProvider({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "secret-test-key", OPENROUTER_CHAT_MODEL: "openrouter/free" },
        async () => ({ ok: false, status: 401, text: async () => "secret-test-key denied" }), async () => {
            await assert.rejects(generate(validBody), (error) => {
                assert.equal(error.code, "AI_PROVIDER_REJECTED_REQUEST");
                assert.doesNotMatch(error.message, /secret-test-key|denied/);
                return true;
            });
        });
});
