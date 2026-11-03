const { z } = require("zod");

const courseSchema = z.object({
    name: z.string().trim().min(2).max(180),
    description: z.string().trim().min(20).max(10_000),
    category: z.string().trim().min(2).max(100),
    level: z.enum(["Básico", "Intermedio", "Avanzado"]),
    intecapCareerType: z.enum(["CTO", "CTM", "CTMS"]).nullable().optional(),
    sourceUrl: z.union([z.string().url().refine((value) => value.startsWith("https://")), z.null()]).optional(),
    durationHours: z.number().positive().max(100_000)
}).strict();

const coursePatchSchema = courseSchema.partial().refine((body) => Object.keys(body).length > 0, {
    message: "Envía al menos un campo para actualizar"
});

const statusSchema = z.object({ isActive: z.boolean() }).strict();

const listSchema = z.object({
    search: z.string().trim().max(160).optional(),
    category: z.string().trim().max(100).optional(),
    level: z.enum(["Básico", "Intermedio", "Avanzado"]).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();

module.exports = { courseSchema, coursePatchSchema, statusSchema, listSchema };
