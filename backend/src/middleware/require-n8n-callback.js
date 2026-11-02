const crypto = require("node:crypto");
const env = require("../config/env");
const ApiError = require("../utils/api-error");

function requireN8nCallback(req, res, next) {
    const configured = env.N8N_CALLBACK_SECRET;
    const supplied = req.get("x-n8n-callback-secret") || "";
    if (!configured) return next(new ApiError(503, "CALLBACK_NOT_CONFIGURED", "La integración no está configurada"));

    const actualDigest = crypto.createHash("sha256").update(supplied).digest();
    const expectedDigest = crypto.createHash("sha256").update(configured).digest();
    if (!crypto.timingSafeEqual(actualDigest, expectedDigest)) {
        return next(new ApiError(401, "CALLBACK_UNAUTHORIZED", "No se pudo autenticar la integración"));
    }
    return next();
}

module.exports = requireN8nCallback;
