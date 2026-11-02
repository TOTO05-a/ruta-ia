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

function formatIssues(issues) {
    return issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
}

module.exports = { registerSchema, loginSchema, formatIssues };
