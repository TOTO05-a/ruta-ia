const env = require("../config/env");
const authService = require("../services/auth.service");
const ApiError = require("../utils/api-error");
const { registerSchema, loginSchema, formatIssues } = require("../validators/auth.validators");
const requireAuth = require("../middleware/require-auth");

function validate(schema, body) {
    const parsed = schema.safeParse(body);
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
    const result = await authService.register(validate(registerSchema, req.body));
    setSessionCookie(res, result.session);
    return res.status(201).json({ data: { student: result.student, csrfToken: result.session.csrfToken } });
}

async function login(req, res) {
    const result = await authService.login(validate(loginSchema, req.body));
    setSessionCookie(res, result.session);
    return res.status(200).json({ data: { student: result.student, csrfToken: result.session.csrfToken } });
}

async function token(req, res) {
    const result = await authService.loginWithJwt(validate(loginSchema, req.body));
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
    await authService.logout(req.auth.session_id);
    if (req.auth_method === "session") clearSessionCookie(res);
    return res.status(204).end();
}

function me(req, res) {
    const { session_id, csrf_token, ...student } = req.auth;
    void session_id; void csrf_token;
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
    const csrfToken = await authService.getCsrf(req.auth.session_id);
    return res.json({ data: { csrfToken } });
}

module.exports = { register, login, token, logout, me, csrf };
