const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const envModule = path.resolve(__dirname, "../src/config/env.js");

function loadConfig(overrides) {
    return spawnSync(process.execPath, ["-e", `require(${JSON.stringify(envModule)})`], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test", ...overrides }
    });
}

test("OpenRouter requiere clave cuando se selecciona como proveedor", () => {
    const result = loadConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "", OPENROUTER_CHAT_MODEL: "openrouter/free" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OPENROUTER_API_KEY/);
});

test("OpenRouter rechaza IDs que no garantizan variante gratuita", () => {
    const result = loadConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "test-key", OPENROUTER_CHAT_MODEL: "openai/gpt-4o" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /solo se permiten openrouter\/free/);
});

test("la configuración predeterminada local no necesita clave OpenRouter", () => {
    const result = loadConfig({ AI_PROVIDER: "ollama", OPENROUTER_API_KEY: "", OPENROUTER_CHAT_MODEL: "openrouter/free" });
    assert.equal(result.status, 0, result.stderr);
});
