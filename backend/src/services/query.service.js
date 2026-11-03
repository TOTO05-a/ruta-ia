const repository = require("../repositories/query.repository");
const studentRepository = require("../repositories/student.repository");
const n8n = require("../integrations/n8n/client");
const ApiError = require("../utils/api-error");

function validateId(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new ApiError(400, "VALIDATION_ERROR", "El identificador no es válido");
    }
}

async function create(student, question) {
    const query = await repository.create(student.id, question);
    try {
        await n8n.startQuery({
            queryId: query.id,
            question: query.question,
            experienceLevel: student.experience_level,
            interestArea: student.interest_area
        });
    } catch (error) {
        await repository.markFailed(query.id, /^[A-Z0-9_]{1,64}$/.test(error.code || "") ? error.code : "N8N_UNAVAILABLE");
    }
    return repository.getById(query.id);
}

async function get(id, student) {
    validateId(id);
    const query = await repository.getById(id);
    if (!query || (query.studentId !== student.id && student.role !== "admin")) {
        throw new ApiError(404, "QUERY_NOT_FOUND", "No se encontró la consulta");
    }
    const { studentId, ...visible } = query;
    void studentId;
    return visible;
}

async function list(studentId, filters) {
    return repository.listByStudent(studentId, filters);
}

async function listStudentHistory(targetStudentId, requestingStudent, filters) {
    validateId(targetStudentId);
    if (targetStudentId !== requestingStudent.id && requestingStudent.role !== "admin") {
        throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    }
    const student = await studentRepository.findById(targetStudentId);
    if (!student) throw new ApiError(404, "STUDENT_NOT_FOUND", "No se encontró el estudiante");
    return repository.listByStudent(targetStudentId, filters);
}

async function receiveCallback(input) {
    try {
        const result = await repository.saveCallback(input);
        if (result.notFound) throw new ApiError(404, "QUERY_NOT_FOUND", "No se encontró la consulta");
        return result;
    } catch (error) {
        if (["DUPLICATE_SOURCES", "SOURCE_NOT_ACTIVE"].includes(error.message)) {
            await repository.markFailed(input.queryId, "N8N_INVALID_SOURCES");
            return { status: "Error" };
        }
        throw error;
    }
}

module.exports = { create, get, list, listStudentHistory, receiveCallback };
