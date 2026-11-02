const service = require("../services/rating.service");
const ApiError = require("../utils/api-error");
const { ratingSchema } = require("../validators/rating.validators");

async function create(req, res) {
    const parsed = ratingSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Revisa la calificación enviada", parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    }
    const rating = await service.create(req.params.id, req.auth.id, parsed.data);
    return res.status(201).json({ data: rating });
}

module.exports = { create };
