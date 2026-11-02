const service = require("../services/course.service");
const ApiError = require("../utils/api-error");
const { courseSchema, coursePatchSchema, statusSchema, listSchema } = require("../validators/course.validators");

function validate(schema, value) {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Revisa los datos enviados", parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    return parsed.data;
}

async function list(req, res) {
    return res.json({ data: await service.getPublicList(validate(listSchema, req.query)) });
}

async function adminList(req, res) {
    return res.json({ data: await service.getAdminList(validate(listSchema, req.query)) });
}

async function get(req, res) {
    return res.json({ data: await service.getById(req.params.id) });
}

async function adminGet(req, res) {
    return res.json({ data: await service.getById(req.params.id, { includeInactive: true }) });
}

async function create(req, res) {
    return res.status(201).json({ data: await service.create(validate(courseSchema, req.body)) });
}

async function update(req, res) {
    return res.json({ data: await service.update(req.params.id, validate(coursePatchSchema, req.body)) });
}

async function setStatus(req, res) {
    const { isActive } = validate(statusSchema, req.body);
    return res.json({ data: await service.setActive(req.params.id, isActive) });
}

module.exports = { list, adminList, get, adminGet, create, update, setStatus };
