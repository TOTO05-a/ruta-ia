const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { registerSchema, loginSchema } = require("../src/validators/auth.validators");
const { courseSchema, coursePatchSchema, statusSchema } = require("../src/validators/course.validators");
const { updateProfileSchema } = require("../src/validators/student.validators");
const { createQuerySchema, callbackSchema } = require("../src/validators/query.validators");
const { ratingSchema } = require("../src/validators/rating.validators");
const requireAdmin = require("../src/middleware/require-admin");
const requireAuth = require("../src/middleware/require-auth");
const jwtService = require("../src/services/jwt.service");
const { hashPassword, verifyPassword } = require("../src/services/password.service");

const JWT_SECRET_FOR_TESTS = "a-distinct-test-jwt-signing-secret-with-32-chars";
const studentId = "7e5ac5b4-5918-4e0a-b784-2b1521759bc1";
const sessionId = "e9c27ea0-8621-4d7a-8d55-3975522db4c8";

function mockResponse() {
    return {
        statusCode: undefined,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function authRequest({ authorization, cookie, csrfToken, method = "POST" } = {}) {
    const headers = {};
    if (authorization !== undefined) headers.authorization = authorization;
    if (cookie !== undefined) headers.cookie = cookie;
    if (csrfToken !== undefined) headers["x-csrf-token"] = csrfToken;
    return {
        headers,
        method,
        requestId: "test-request",
        get(name) { return headers[name.toLowerCase()]; }
    };
}

test("JWT firma y valida issuer, audience, expiración e integridad", () => {
    const now = 1_700_000_000_000;
    const signed = jwtService.sign(
        { id: studentId, role: "student" },
        { id: sessionId, expiresAt: new Date(now + 3_600_000) },
        { secret: JWT_SECRET_FOR_TESTS, now, ttlSeconds: 600 }
    );
    const claims = jwtService.verify(signed.token, { secret: JWT_SECRET_FOR_TESTS, now });
    assert.equal(claims.sub, studentId);
    assert.equal(claims.sid, sessionId);
    assert.equal(claims.role, "student");
    assert.equal(claims.iss, jwtService.ISSUER);
    assert.equal(claims.aud, jwtService.AUDIENCE);
    assert.equal(claims.exp - claims.iat, 600);
    assert.equal(jwtService.verify(`${signed.token}x`, { secret: JWT_SECRET_FOR_TESTS, now }), null);
    assert.equal(jwtService.verify("not.a.jwt", { secret: JWT_SECRET_FOR_TESTS, now }), null);
    assert.equal(
        jwtService.verify(signed.token, { secret: JWT_SECRET_FOR_TESTS, now: now + signed.expiresIn * 1000 }),
        null
    );
});

test("secret JWT configurado debe ser suficientemente largo y distinto del de sesión", () => {
    const envModule = path.resolve(__dirname, "../src/config/env.js");
    const load = (overrides) => spawnSync(process.execPath, ["-e", `require(${JSON.stringify(envModule)})`], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "test", JWT_SECRET: "", ...overrides }
    });

    const valid = load({ JWT_SECRET: JWT_SECRET_FOR_TESTS });
    assert.equal(valid.status, 0, valid.stderr);
    assert.notEqual(load({ JWT_SECRET: "too-short" }).status, 0);
    assert.notEqual(load({ SESSION_SECRET: JWT_SECRET_FOR_TESTS, JWT_SECRET: JWT_SECRET_FOR_TESTS }).status, 0);
});

test("Bearer usa rol vigente de la base de datos y no requiere CSRF", async () => {
    const now = Date.now();
    const signed = jwtService.sign(
        { id: studentId, role: "admin" },
        { id: sessionId, expiresAt: new Date(now + 3_600_000) },
        { secret: JWT_SECRET_FOR_TESTS }
    );
    const row = {
        session_id: sessionId,
        csrf_token: "unused",
        id: studentId,
        full_name: "Ana Pérez",
        email: "ana@example.com",
        experience_level: "Principiante",
        interest_area: "Desarrollo web",
        role: "student"
    };
    const queries = [];
    const middleware = requireAuth.create({
        pool: { async query(sql, params) { queries.push({ sql, params }); return { rowCount: 1, rows: [row] }; } },
        verifyToken: (token) => jwtService.verify(token, { secret: JWT_SECRET_FOR_TESTS })
    });
    const req = authRequest({ authorization: `Bearer ${signed.token}` });
    const res = mockResponse();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.auth_method, "bearer");
    assert.equal(req.auth.role, "student");
    assert.deepEqual(queries[0].params, [sessionId, studentId]);
    let denied;
    requireAdmin(req, {}, (error) => { denied = error; });
    assert.equal(denied.status, 403);
});

test("sesión cookie conserva CSRF y Bearer inválido no cae a cookie", async () => {
    const cookieToken = crypto.randomBytes(32).toString("base64url");
    const row = {
        session_id: sessionId,
        csrf_token: "valid-csrf",
        id: studentId,
        role: "student"
    };
    const middleware = requireAuth.create({
        pool: { async query() { return { rowCount: 1, rows: [row] }; } },
        verifyToken: () => null
    });

    const validRequest = authRequest({
        cookie: `${requireAuth.COOKIE_NAME}=${cookieToken}`,
        csrfToken: "valid-csrf"
    });
    const validResponse = mockResponse();
    let nextCalled = false;
    await middleware(validRequest, validResponse, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(validRequest.auth_method, "session");

    const csrfResponse = mockResponse();
    await middleware(authRequest({ cookie: `${requireAuth.COOKIE_NAME}=${cookieToken}` }), csrfResponse, () => {});
    assert.equal(csrfResponse.statusCode, 403);
    assert.equal(csrfResponse.body.error.code, "CSRF_INVALID");

    const invalidBearerResponse = mockResponse();
    let databaseQueried = false;
    const noFallback = requireAuth.create({
        pool: { async query() { databaseQueried = true; return { rowCount: 1, rows: [row] }; } },
        verifyToken: () => null
    });
    await noFallback(authRequest({
        authorization: "Bearer malformed",
        cookie: `${requireAuth.COOKIE_NAME}=${cookieToken}`,
        csrfToken: "valid-csrf"
    }), invalidBearerResponse, () => {});
    assert.equal(invalidBearerResponse.statusCode, 401);
    assert.equal(databaseQueried, false);
});

test("registro exige perfil completo y contraseña segura", () => {
    const valid = registerSchema.safeParse({
        fullName: "Ana Pérez",
        email: "ana@example.com",
        password: "una-clave-segura-2026",
        experienceLevel: "Principiante",
        interestArea: "Desarrollo web"
    });
    assert.equal(valid.success, true);

    const invalid = registerSchema.safeParse({
        fullName: "A",
        email: "no-es-correo",
        password: "corta",
        experienceLevel: "Experto",
        interestArea: ""
    });
    assert.equal(invalid.success, false);
});

test("inicio de sesión rechaza campos adicionales", () => {
    assert.equal(loginSchema.safeParse({ email: "a@example.com", password: "correcta", role: "admin" }).success, false);
});

test("contraseñas usan hash salado y se verifican sin guardar texto plano", async () => {
    const password = "una-clave-segura-2026";
    const hash = await hashPassword(password);
    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.notEqual(hash, password);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword("otra-clave-segura", hash), false);
});

test("curso exige descripción, nivel permitido y duración positiva", () => {
    const course = {
        name: "Desarrollo web inicial",
        description: "Fundamentos prácticos para construir páginas web accesibles y adaptables.",
        category: "Desarrollo web",
        level: "Básico",
        durationHours: 24
    };
    assert.equal(courseSchema.safeParse(course).success, true);
    assert.equal(courseSchema.safeParse({ ...course, durationHours: 0 }).success, false);
    assert.equal(courseSchema.safeParse({ ...course, intecapCareerType: "CTM" }).success, true);
    assert.equal(courseSchema.safeParse({ ...course, intecapCareerType: "Técnico medio" }).success, false);
    assert.equal(courseSchema.safeParse({ ...course, sourceUrl: "https://cursos.intecap.edu.gt/detalle/902/2027" }).success, true);
    assert.equal(courseSchema.safeParse({ ...course, sourceUrl: "http://cursos.intecap.edu.gt/detalle/902/2027" }).success, false);
    assert.equal(courseSchema.safeParse({ ...course, sourceUrl: null }).success, true);
    assert.equal(courseSchema.safeParse({ ...course, description: "corto" }).success, false);
    assert.equal(coursePatchSchema.safeParse({}).success, false);
    assert.equal(statusSchema.safeParse({ isActive: "false" }).success, false);
});

test("perfil admite solo campos editables y la ruta administrativa exige rol", () => {
    assert.equal(updateProfileSchema.safeParse({ experienceLevel: "Avanzado" }).success, true);
    assert.equal(updateProfileSchema.safeParse({ email: "nuevo@example.com" }).success, false);
    let denied;
    requireAdmin({ auth: { role: "student" } }, {}, (error) => { denied = error; });
    assert.equal(denied.status, 403);
});

test("preguntas vacías se rechazan antes de persistir o llamar a n8n", () => {
    assert.equal(createQuerySchema.safeParse({ question: "   " }).success, false);
    assert.equal(createQuerySchema.safeParse({ question: "Quiero aprender desarrollo web" }).success, true);
});

test("callback de n8n valida estado, entre tres y cinco fuentes y score finito", () => {
    const id = "7e5ac5b4-5918-4e0a-b784-2b1521759bc1";
    const response = {
        queryId: id,
        status: "Respondida",
        answer: "Respuesta basada en las fuentes.",
        summary: "Resumen.",
        explanation: "Explicación basada en el catálogo.",
        sources: [1, 2, 3].map((n) => ({
            courseId: `7e5ac5b4-5918-4e0a-b784-2b1521759bc${n}`,
            similarity: 0.7 + n / 100
        }))
    };
    assert.equal(callbackSchema.safeParse(response).success, true);
    assert.equal(callbackSchema.safeParse({ ...response, sources: response.sources.slice(0, 2) }).success, false);
    assert.equal(callbackSchema.safeParse({ ...response, sources: [{ ...response.sources[0], similarity: Infinity }, ...response.sources.slice(1)] }).success, false);
    assert.equal(callbackSchema.safeParse({ queryId: id, status: "Sin resultados" }).success, true);
});

test("calificación solo permite una puntuación entera entre una y cinco", () => {
    assert.equal(ratingSchema.safeParse({ score: 5, comment: "Muy útil" }).success, true);
    assert.equal(ratingSchema.safeParse({ score: 0 }).success, false);
    assert.equal(ratingSchema.safeParse({ score: 5.5 }).success, false);
});
