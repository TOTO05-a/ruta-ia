const pool = require("../db/pool");
const ApiError = require("../utils/api-error");
const { hashPassword, verifyPassword } = require("./password.service");
const { createSession, destroySession } = require("./session.service");
const jwtService = require("./jwt.service");
const studentRepository = require("../repositories/student.repository");
const env = require("../config/env");

function publicStudent(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        experienceLevel: row.experience_level,
        interestArea: row.interest_area,
        role: row.role
    };
}

async function register(input) {
    const db = await pool.connect();
    try {
        await db.query("BEGIN");
        const passwordHash = await hashPassword(input.password);
        const result = await db.query(
            `INSERT INTO students (full_name, email, password_hash, experience_level, interest_area)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, full_name, email, experience_level, interest_area, role`,
            [input.fullName, input.email.toLowerCase(), passwordHash, input.experienceLevel, input.interestArea]
        );
        const student = result.rows[0];
        const session = await createSession(student.id, db);
        await db.query("COMMIT");
        return { student: publicStudent(student), session };
    } catch (error) {
        await db.query("ROLLBACK").catch(() => {});
        if (error.code === "23505" && error.constraint === "students_email_lower_unique") {
            throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "Ya existe una cuenta con ese correo");
        }
        throw error;
    } finally {
        db.release();
    }
}

async function authenticate(input) {
    const result = await pool.query(
        `SELECT id, full_name, email, experience_level, interest_area, role, password_hash
         FROM students WHERE lower(email) = lower($1)`,
        [input.email]
    );
    const student = result.rows[0];
    const valid = student && await verifyPassword(input.password, student.password_hash);
    if (!valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos");
    return student;
}

async function login(input) {
    const student = await authenticate(input);
    const session = await createSession(student.id);
    return { student: publicStudent(student), session };
}

async function loginWithJwt(input) {
    if (!env.JWT_SECRET) {
        throw new ApiError(503, "JWT_NOT_CONFIGURED", "La autenticación Bearer no está configurada");
    }
    const student = await authenticate(input);
    const session = await createSession(student.id);
    const access = jwtService.sign(student, session);
    return { student: publicStudent(student), ...access };
}

async function logout(sessionId) {
    await destroySession(sessionId);
}

async function getCsrf(sessionId) {
    const result = await pool.query("SELECT csrf_token FROM sessions WHERE id = $1", [sessionId]);
    if (!result.rowCount) throw new ApiError(401, "SESSION_EXPIRED", "La sesión expiró");
    return result.rows[0].csrf_token;
}

function validateId(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new ApiError(400, "VALIDATION_ERROR", "El identificador no es válido");
    }
}

async function updateProfile(id, changes) {
    const student = await studentRepository.updateProfile(id, changes);
    if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    return student;
}

async function list(pagination) {
    return studentRepository.list(pagination);
}

async function getById(id) {
    validateId(id);
    const student = await studentRepository.findById(id);
    if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    return student;
}

module.exports = { register, login, loginWithJwt, logout, getCsrf, updateProfile, list, getById };
