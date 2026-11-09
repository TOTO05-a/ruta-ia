const crypto = require("node:crypto");
const pool = require("../db/pool");
const env = require("../config/env");
const jwtService = require("../services/jwt.service");
const ApiError = require("../utils/api-error");

const COOKIE_NAME = "rutaia_session";

function digest(value) {
    const secret = env.SESSION_SECRET || "local-development-session-key-not-for-production";
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function parseCookies(header = "") {
    return Object.fromEntries(header.split(";").map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return ["", ""];
        const name = part.slice(0, index).trim();
        try { return [name, decodeURIComponent(part.slice(index + 1).trim())]; }
        catch { return [name, ""]; }
    }).filter(([name]) => name));
}

function unauthenticated(req, res) {
    return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Inicia sesión para continuar", requestId: req.requestId }
    });
}

function createRequireAuth(options = {}) {
    const database = options.pool || pool;
    const verifyToken = options.verifyToken || ((token) => jwtService.verify(token));

    return async function requireAuth(req, res, next) {
        try {
            const authorization = req.headers.authorization;
            if (authorization !== undefined) {
                const match = typeof authorization === "string" && /^Bearer\s+([^\s]+)$/i.exec(authorization);
                const claims = match && verifyToken(match[1]);
                if (!claims) return unauthenticated(req, res);

                const result = await database.query(
                    `SELECT s.id AS session_id, s.csrf_token, st.id, st.full_name, st.email,
                            st.experience_level, st.interest_area, st.role
                     FROM sessions s JOIN students st ON st.id = s.student_id
                     WHERE s.id = $1 AND s.student_id = $2 AND s.expires_at > now()`,
                    [claims.sid, claims.sub]
                );
                if (!result.rowCount) {
                    return res.status(401).json({
                        error: { code: "SESSION_EXPIRED", message: "La sesión expiró", requestId: req.requestId }
                    });
                }

                req.auth = result.rows[0];
                req.auth_method = "bearer";
                return next();
            }

            const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
            if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) return unauthenticated(req, res);

            const result = await database.query(
                `SELECT s.id AS session_id, s.csrf_token, st.id, st.full_name, st.email,
                        st.experience_level, st.interest_area, st.role
                 FROM sessions s JOIN students st ON st.id = s.student_id
                 WHERE s.token_hash = $1 AND s.expires_at > now()`,
                [digest(token)]
            );

            if (!result.rowCount) {
                return res.status(401).json({ error: { code: "SESSION_EXPIRED", message: "La sesión expiró", requestId: req.requestId } });
            }

            req.auth = result.rows[0];
            req.auth_method = "session";
            if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
                const csrf = req.get("x-csrf-token");
                if (!csrf || !crypto.timingSafeEqual(Buffer.from(digest(csrf)), Buffer.from(digest(req.auth.csrf_token)))) {
                    return res.status(403).json({ error: { code: "CSRF_INVALID", message: "La solicitud no pudo validarse", requestId: req.requestId } });
                }
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
}

const requireAuth = createRequireAuth();
requireAuth.COOKIE_NAME = COOKIE_NAME;
requireAuth.digest = digest;
requireAuth.parseCookies = parseCookies;
requireAuth.create = createRequireAuth;

function requireAdmin(req, res, next) {
    if (!req.auth || req.auth.role !== "admin") {
        return next(new ApiError(403, "FORBIDDEN", "No tienes permiso para esta operación"));
    }
    return next();
}

module.exports = { requireAuth, requireAdmin, digest, parseCookies };
