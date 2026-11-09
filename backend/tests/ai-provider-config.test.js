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

test("la app puede iniciar sin claves de proveedor configuradas", () => {
    const result = loadConfig({ GEMINI_API_KEY: "", OPENROUTER_API_KEY: "", OPENROUTER_CHAT_MODEL: "" });
    assert.equal(result.status, 0, result.stderr);
});

test("la configuración conserva el modelo OpenRouter indicado", () => {
    const result = spawnSync(process.execPath, ["-e", `process.stdout.write(JSON.stringify(require(${JSON.stringify(envModule)})))`], {
        encoding: "utf8", env: { ...process.env, NODE_ENV: "test", OPENROUTER_CHAT_MODEL: "provider/model" }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).OPENROUTER_CHAT_MODEL, "provider/model");
});

test("la colección Gemini usa dimensiones fijas independientes del índice anterior", () => {
    const result = spawnSync(process.execPath, ["-e", `process.stdout.write(JSON.stringify(require(${JSON.stringify(envModule)})))`], {
        encoding: "utf8", env: { ...process.env, NODE_ENV: "test", GEMINI_API_KEY: "" }
    });
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.GEMINI_EMBEDDING_MODEL, "gemini-embedding-2");
    assert.equal(config.GEMINI_EMBEDDING_DIMENSIONS, 1536);
    assert.equal(config.QDRANT_COLLECTION, "rutaia_courses_gemini_1536");
});
