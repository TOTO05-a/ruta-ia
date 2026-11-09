const { z } = require("zod");

const registerSchema = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.email().trim().max(254),
    password: z.string().min(12).max(128),
    experienceLevel: z.enum(["Principiante", "Intermedio", "Avanzado"]),
    interestArea: z.string().trim().min(2).max(120)
}).strict();

const loginSchema = z.object({
    email: z.email().trim().max(254),
    password: z.string().min(1).max(128)
}).strict();

const updateProfileSchema = z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    experienceLevel: z.enum(["Principiante", "Intermedio", "Avanzado"]).optional(),
    interestArea: z.string().trim().min(2).max(120).optional()
}).strict().refine((body) => Object.keys(body).length > 0, { message: "Envía al menos un campo para actualizar" });

const listSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

function formatIssues(issues) {
    return issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}

module.exports = { registerSchema, loginSchema, updateProfileSchema, listSchema, formatIssues };
