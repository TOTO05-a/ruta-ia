function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
    if (res.headersSent) return next(error);

    if (error?.type === "entity.parse.failed") {
        return res.status(400).json({
            error: { code: "INVALID_JSON", message: "El cuerpo JSON no es válido", requestId: req.requestId }
        });
    }

    const status = Number.isInteger(error?.status) ? error.status : 500;
    const code = error?.code && typeof error.code === "string"
        ? error.code
        : "INTERNAL_ERROR";

    if (status >= 500) {
        console.error("Error de solicitud", { requestId: req.requestId, code: error?.code || error?.name || "UNKNOWN" });
    }

    return res.status(status).json({
        error: {
            code,
            message: status >= 500 ? "Error interno del servidor" : error.message,
            ...(error.details ? { details: error.details } : {}),
            requestId: req.requestId
        }
    });
}

module.exports = errorHandler;
