const env = require("../config/env");
const service = require("../services/account.service");
const ApiError = require("../utils/api-error");
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    listSchema,
    formatIssues
} = require("../validators/account.validators");
const { requireAuth } = require("../middleware/auth");

function validate(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Revisa los datos enviados", formatIssues(parsed.error.issues));
    }
    return parsed.data;
}

function setSessionCookie(res, session) {
    const maxAge = Math.max(0, session.expiresAt.getTime() - Date.now());
    const flags = [
        `${requireAuth.COOKIE_NAME}=${encodeURIComponent(session.token)}`,
        "Path=/api/v1",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${Math.floor(maxAge / 1000)}`
    ];
    if (env.NODE_ENV === "production") flags.push("Secure");
    res.setHeader("Set-Cookie", flags.join("; "));
}

function clearSessionCookie(res) {
    const flags = [`${requireAuth.COOKIE_NAME}=`, "Path=/api/v1", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
    if (env.NODE_ENV === "production") flags.push("Secure");
    res.setHeader("Set-Cookie", flags.join("; "));
}

async function register(req, res) {
    const result = await service.register(validate(registerSchema, req.body));
    setSessionCookie(res, result.session);
    return res.status(201).json({ data: { student: result.student, csrfToken: result.session.csrfToken } });
}

async function login(req, res) {
    const result = await service.login(validate(loginSchema, req.body));
    setSessionCookie(res, result.session);
    return res.status(200).json({ data: { student: result.student, csrfToken: result.session.csrfToken } });
}

async function token(req, res) {
    const result = await service.loginWithJwt(validate(loginSchema, req.body));
    return res.status(200).json({
        data: {
            accessToken: result.token,
            tokenType: "Bearer",
            expiresIn: result.expiresIn,
            expiresAt: result.expiresAt.toISOString(),
            student: result.student
        }
    });
}

async function logout(req, res) {
    await service.logout(req.auth.session_id);
    if (req.auth_method === "session") clearSessionCookie(res);
    return res.status(204).end();
}

function me(req, res) {
    const { session_id, csrf_token, ...student } = req.auth;
    void session_id;
    void csrf_token;
    return res.json({ data: { student: {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        experienceLevel: student.experience_level,
        interestArea: student.interest_area,
        role: student.role
    } } });
}

async function csrf(req, res) {
    const csrfToken = await service.getCsrf(req.auth.session_id);
    return res.json({ data: { csrfToken } });
}

async function updateMe(req, res) {
    return res.json({ data: await service.updateProfile(req.auth.id, validate(updateProfileSchema, req.body)) });
}

async function list(req, res) {
    return res.json({ data: await service.list(validate(listSchema, req.query)) });
}

async function getById(req, res) {
    return res.json({ data: await service.getById(req.params.id) });
}

module.exports = { register, login, token, logout, me, csrf, updateMe, list, getById };
