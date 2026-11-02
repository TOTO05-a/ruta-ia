const repository = require("../repositories/student.repository");
const ApiError = require("../utils/api-error");

function validateId(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new ApiError(400, "VALIDATION_ERROR", "El identificador no es válido");
    }
}

async function updateProfile(id, changes) {
    const student = await repository.updateProfile(id, changes);
    if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    return student;
}

async function list(pagination) {
    return repository.list(pagination);
}

async function getById(id) {
    validateId(id);
    const student = await repository.findById(id);
    if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    return student;
}

module.exports = { updateProfile, list, getById };
