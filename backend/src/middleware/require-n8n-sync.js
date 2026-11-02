const crypto = require("node:crypto");
const env = require("../config/env");
const ApiError = require("../utils/api-error");

function requireN8nSync(req, res, next) {
    const expected = env.N8N_COURSE_SYNC_SECRET || "";
    const supplied = req.get("x-n8n-sync-secret") || "";
    const actualHash = crypto.createHash("sha256").update(supplied).digest();
    const expectedHash = crypto.createHash("sha256").update(expected).digest();
    if (!expected) return next(new ApiError(503, "COURSE_SYNC_NOT_CONFIGURED", "La sincronización no está configurada"));
    if (!crypto.timingSafeEqual(actualHash, expectedHash)) return next(new ApiError(401, "SYNC_UNAUTHORIZED", "No se pudo autenticar la sincronización"));
    return next();
}

module.exports = requireN8nSync;
