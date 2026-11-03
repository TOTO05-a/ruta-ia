const test = require("node:test");
const assert = require("node:assert/strict");
const { registerSchema, loginSchema } = require("../src/validators/auth.validators");
const { courseSchema, coursePatchSchema, statusSchema } = require("../src/validators/course.validators");
const { updateProfileSchema } = require("../src/validators/student.validators");
const { createQuerySchema, callbackSchema } = require("../src/validators/query.validators");
const { ratingSchema } = require("../src/validators/rating.validators");
const requireAdmin = require("../src/middleware/require-admin");
const { hashPassword, verifyPassword } = require("../src/services/password.service");

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
