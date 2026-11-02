const service = require("../services/student.service");
const ApiError = require("../utils/api-error");
const { updateProfileSchema, listSchema } = require("../validators/student.validators");

function validate(schema, value) {
    const result = schema.safeParse(value);
    if (!result.success) throw new ApiError(400, "VALIDATION_ERROR", "Revisa los datos enviados", result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    return result.data;
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

module.exports = { updateMe, list, getById };
