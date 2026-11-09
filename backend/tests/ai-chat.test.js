const assert = require("node:assert/strict");
const test = require("node:test");

const env = require("../src/config/env");
const { generateChat } = require("../src/integrations/ai/gemini");

async function withProvider(overrides, fetchMock, action) {
    const keys = ["GEMINI_API_KEY", "GEMINI_CHAT_MODEL", "AI_CHAT_TIMEOUT_MS"];
    const prior = Object.fromEntries(keys.map((key) => [key, env[key]]));
    const priorFetch = global.fetch;
    Object.assign(env, { GEMINI_API_KEY: "test-key", GEMINI_CHAT_MODEL: "gemini-3.5-flash-lite", AI_CHAT_TIMEOUT_MS: 1000, ...overrides });
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

test("Gemini recibe la conversación y responde en el formato normalizado del backend", async () => {
    let request;
    await withProvider({}, async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: generatedContent }] }, finishReason: "STOP" }] }) };
    }, async () => {
        const result = await generateChat(validBody);
        assert.equal(result.message.content, generatedContent);
    });

    assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    assert.equal(request.options.headers["x-goog-api-key"], "test-key");
    const body = JSON.parse(request.options.body);
    assert.equal(body.systemInstruction.parts[0].text, "Responde solo con los cursos indicados.");
    assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "Busco gastronomía." }] }]);
    assert.deepEqual(body.generationConfig, { temperature: 0.2, maxOutputTokens: 192, responseMimeType: "application/json" });
    assert.equal(JSON.stringify(body).includes("test-key"), false);
});

test("proxy rechaza mensajes malformados antes de contactar al proveedor", async () => {
    let called = false;
    await withProvider({}, async () => { called = true; }, async () => {
        await assert.rejects(generateChat({ messages: [{ role: "developer", content: "x" }] }), (error) => error.code === "AI_CHAT_INVALID_INPUT");
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
        ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "{\\\"answer\\\":" }] }, finishReason: "MAX_TOKENS" }] })
    }), async () => {
        await assert.rejects(generateChat(validBody), (error) => error.code === "AI_PROVIDER_INCOMPLETE_RESPONSE");
    });
});
