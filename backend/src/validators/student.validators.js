const { z } = require("zod");

const updateProfileSchema = z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    experienceLevel: z.enum(["Principiante", "Intermedio", "Avanzado"]).optional(),
    interestArea: z.string().trim().min(2).max(120).optional()
}).strict().refine((body) => Object.keys(body).length > 0, { message: "Envía al menos un campo para actualizar" });

const listSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

module.exports = { updateProfileSchema, listSchema };
