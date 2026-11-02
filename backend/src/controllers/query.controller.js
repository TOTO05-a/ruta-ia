const service = require("../services/query.service");
const ApiError = require("../utils/api-error");
const { createQuerySchema, callbackSchema, paginationSchema } = require("../validators/query.validators");

function validate(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Revisa los datos enviados", parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    return parsed.data;
}

async function create(req, res) {
    const { question } = validate(createQuerySchema, req.body);
    const query = await service.create(req.auth, question);
    return res.status(202).json({ data: { id: query.id, question: query.question, status: query.status, createdAt: query.createdAt } });
}

async function get(req, res) {
    return res.json({ data: await service.get(req.params.id, req.auth) });
}

async function list(req, res) {
    return res.json({ data: await service.list(req.auth.id, validate(paginationSchema, req.query)) });
}

async function studentHistory(req, res) {
    return res.json({ data: await service.listStudentHistory(req.params.id, req.auth, validate(paginationSchema, req.query)) });
}

async function callback(req, res) {
    const parsed = callbackSchema.safeParse(req.body);
    if (!parsed.success) {
        if (typeof req.body?.queryId === "string" && /^[0-9a-f-]{36}$/i.test(req.body.queryId)) {
            await require("../repositories/query.repository").markFailed(req.body.queryId, "N8N_INVALID_CALLBACK");
        }
        throw new ApiError(400, "INVALID_CALLBACK", "El resultado de automatización no cumple el contrato", parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    }
    const result = await service.receiveCallback(parsed.data);
    return res.status(result.duplicate ? 200 : 202).json({ data: result });
}

module.exports = { create, get, list, studentHistory, callback };
