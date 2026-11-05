const crypto = require("node:crypto");
const env = require("../config/env");

const ISSUER = "rutaia-api";
const AUDIENCE = "rutaia-client";
const MAX_TOKEN_TTL_SECONDS = 86400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(["student", "admin"]);

function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(student, session, options = {}) {
    const secret = options.secret === undefined ? env.JWT_SECRET : options.secret;
    if (!secret) throw new Error("JWT no está configurado");

    const now = Math.floor((options.now ?? Date.now()) / 1000);
    const sessionExpiry = Math.floor(session.expiresAt.getTime() / 1000);
    const exp = Math.min(now + (options.ttlSeconds ?? env.JWT_TTL_SECONDS), sessionExpiry);
    if (exp <= now) throw new Error("La sesión expiró");

    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({
        iss: ISSUER,
        aud: AUDIENCE,
        sub: student.id,
        sid: session.id,
        role: student.role,
        iat: now,
        exp
    });
    const signingInput = `${header}.${payload}`;
    const signature = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
    return {
        token: `${signingInput}.${signature}`,
        expiresAt: new Date(exp * 1000),
        expiresIn: exp - now
    };
}

function verify(token, options = {}) {
    const secret = options.secret === undefined ? env.JWT_SECRET : options.secret;
    if (!secret || typeof token !== "string" || token.length > 8192) return null;

    try {
        const parts = token.split(".");
        if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
        const [encodedHeader, encodedPayload, encodedSignature] = parts;
        const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
        if (header.alg !== "HS256" || header.typ !== "JWT") return null;

        const expected = crypto.createHmac("sha256", secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest();
        const actual = Buffer.from(encodedSignature, "base64url");
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

        const now = Math.floor((options.now ?? Date.now()) / 1000);
        if (
            payload.iss !== ISSUER
            || payload.aud !== AUDIENCE
            || !UUID_PATTERN.test(payload.sub)
            || !UUID_PATTERN.test(payload.sid)
            || !ROLES.has(payload.role)
            || !Number.isInteger(payload.iat)
            || !Number.isInteger(payload.exp)
            || payload.iat > now + 30
            || payload.exp <= now
            || payload.exp <= payload.iat
            || payload.exp - payload.iat > MAX_TOKEN_TTL_SECONDS
        ) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = { sign, verify, ISSUER, AUDIENCE };
