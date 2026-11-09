const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { generateChat } = require("../src/integrations/ai/openrouter");

async function withProvider(overrides, fetchMock, action) {
    const keys = ["OPENROUTER_API_KEY", "OPENROUTER_CHAT_MODEL", "AI_CHAT_TIMEOUT_MS", "FRONTEND_URL"];
    const prior = Object.fromEntries(keys.map((key) => [key, env[key]]));
    const priorFetch = global.fetch;
    Object.assign(env, { OPENROUTER_API_KEY: "test-key", OPENROUTER_CHAT_MODEL: "test/model", AI_CHAT_TIMEOUT_MS: 1000, FRONTEND_URL: "http://localhost:3000", ...overrides });
    global.fetch = fetchMock;
    try { return await action(); }
    finally { Object.assign(env, prior); global.fetch = priorFetch; }
}

const validBody = {
    format: { type: "object", required: ["answer", "summary", "explanation"] },
    options: { temperature: 0.2, num_predict: 192 },
    messages: [{ role: "system", content: "Responde solo con los cursos indicados." }, { role: "user", content: "Busco gastronomía." }]
};
const generatedContent = JSON.stringify({ answer: "Cursos encontrados", summary: "Resumen", explanation: "Fuentes" });

test("OpenRouter recibe la conversación y responde en el formato normalizado del backend", async () => {
    let request;
    await withProvider({}, async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ choices: [{ message: { content: generatedContent }, finish_reason: "stop" }] }) };
    }, async () => {
        const result = await generateChat(validBody);
        assert.equal(result.message.content, generatedContent);
    });

    assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(request.options.headers.authorization, "Bearer test-key");
    assert.equal(request.options.headers["HTTP-Referer"], "http://localhost:3000");
    const body = JSON.parse(request.options.body);
    assert.equal(body.model, "test/model");
    assert.deepEqual(body.messages, validBody.messages);
    assert.equal(body.temperature, 0.2);
    assert.equal(body.max_tokens, 192);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(JSON.stringify(body).includes("test-key"), false);
});

test("proxy rechaza mensajes malformados antes de contactar al proveedor", async () => {
    let called = false;
    await withProvider({}, async () => { called = true; }, async () => {
        await assert.rejects(generateChat({ messages: [{ role: "developer", content: "x" }] }), (error) => error.code === "AI_CHAT_INVALID_INPUT");
    });
    assert.equal(called, false);
});

test("proxy exige clave y modelo OpenRouter antes de contactar al proveedor", async () => {
    let called = false;
    await withProvider({ OPENROUTER_API_KEY: "", OPENROUTER_CHAT_MODEL: undefined }, async () => {
        called = true;
    }, async () => {
        await assert.rejects(generateChat(validBody), (error) => error.code === "AI_PROVIDER_NOT_CONFIGURED");
    });
    assert.equal(called, false);
});

test("el error del proveedor no filtra detalles ni claves", async () => {
    await withProvider({}, async () => ({ ok: false, status: 401, text: async () => "test-key denied" }), async () => {
        await assert.rejects(generateChat(validBody), (error) => {
            assert.equal(error.code, "AI_PROVIDER_REJECTED_REQUEST");
            assert.doesNotMatch(error.message, /test-key|denied/);
            return true;
        });
    });
});

test("proxy identifica límite de solicitudes sin exponer el cuerpo del proveedor", async () => {
    await withProvider({}, async () => ({ ok: false, status: 429, text: async () => "quota exceeded" }), async () => {
        await assert.rejects(generateChat(validBody), (error) => error.code === "AI_PROVIDER_RATE_LIMITED");
    });
});

test("proxy rechaza respuestas JSON estructuradas truncadas", async () => {
    await withProvider({}, async () => ({
        ok: true, json: async () => ({ choices: [{ message: { content: "{\\\"answer\\\":" }, finish_reason: "length" }] })
    }), async () => {
        await assert.rejects(generateChat(validBody), (error) => error.code === "AI_PROVIDER_INCOMPLETE_RESPONSE");
    });
});
