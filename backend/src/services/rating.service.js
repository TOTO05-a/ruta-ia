const repository = require("../repositories/rating.repository");
const ApiError = require("../utils/api-error");

async function create(recommendationId, studentId, input) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recommendationId)) {
        throw new ApiError(400, "VALIDATION_ERROR", "El identificador no es válido");
    }
    const rating = await repository.create(recommendationId, studentId, input);
    if (rating.notFound) throw new ApiError(404, "RECOMMENDATION_NOT_FOUND", "No se encontró la recomendación");
    if (rating.duplicate) throw new ApiError(409, "RATING_ALREADY_EXISTS", "La recomendación ya tiene una calificación");
    return rating;
}

module.exports = { create };
