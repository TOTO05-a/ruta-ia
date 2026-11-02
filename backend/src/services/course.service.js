const repository = require("../repositories/course.repository");
const ApiError = require("../utils/api-error");

function uuid(value) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new ApiError(400, "VALIDATION_ERROR", "El identificador no es válido");
    }
    return value;
}

async function getPublicList(filters) {
    return repository.list(filters);
}

async function getAdminList(filters) {
    return repository.list(filters, { includeInactive: true });
}

async function getById(id, options) {
    const course = await repository.findById(uuid(id), options);
    if (!course) throw new ApiError(404, "COURSE_NOT_FOUND", "No se encontró el curso");
    return course;
}

async function create(course) {
    return repository.create(course);
}

async function update(id, changes) {
    const updated = await repository.update(uuid(id), changes);
    if (!updated) throw new ApiError(404, "COURSE_NOT_FOUND", "No se encontró el curso");
    return updated;
}

async function setActive(id, isActive) {
    const updated = await repository.setActive(uuid(id), isActive);
    if (!updated) throw new ApiError(404, "COURSE_NOT_FOUND", "No se encontró el curso");
    return updated;
}

module.exports = { getPublicList, getAdminList, getById, create, update, setActive };
