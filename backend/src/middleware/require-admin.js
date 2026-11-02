const ApiError = require("../utils/api-error");

function requireAdmin(req, res, next) {
    if (!req.auth || req.auth.role !== "admin") {
        return next(new ApiError(403, "FORBIDDEN", "No tienes permiso para esta operación"));
    }
    return next();
}

module.exports = requireAdmin;
