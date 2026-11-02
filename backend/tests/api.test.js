const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const pool = require("../src/db/pool");

let server;
let baseUrl;

test.before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
});

test("health responde sin declarar PostgreSQL listo", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "rutaia-api");
});

test("frontend estático se sirve desde el mismo origen", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(await response.text(), /Encuentra tu/);
});

test("JSON malformado devuelve error de validación y requestId", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
    });
    assert.equal(response.status, 400);
    assert.ok(response.headers.get("x-request-id"));
    assert.equal((await response.json()).error.code, "INVALID_JSON");
});

test("rutas inexistentes devuelven 404 con error normalizado", async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "NOT_FOUND");
});
