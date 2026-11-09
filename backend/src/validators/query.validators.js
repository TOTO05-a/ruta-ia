const { z } = require("zod");

const queryTextSchema = z.string().trim().min(1).max(4000);

const createQuerySchema = z.object({
    question: queryTextSchema.optional(),
    pregunta: queryTextSchema.optional(),
    umbral: z.number().min(-1).max(1).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    level: z.enum(["Básico", "Intermedio", "Avanzado"]).optional()
}).strict()
    .refine((value) => Boolean(value.question) !== Boolean(value.pregunta), {
        message: "Envía question o pregunta, pero no ambos",
        path: ["question"]
    })
    .transform(({ pregunta, ...value }) => ({
        ...value,
        question: value.question ?? pregunta
    }));

const callbackSchema = z.discriminatedUnion("status", [
    z.object({
        queryId: z.uuid(),
        status: z.literal("Respondida"),
        answer: z.string().trim().min(1).max(20_000),
        summary: z.string().trim().min(1).max(1000),
        explanation: z.string().trim().min(1).max(6000),
        sources: z.array(z.object({
            courseId: z.uuid(),
            similarity: z.number().finite()
        }).strict()).min(1).max(5)
    }).strict(),
    z.object({ queryId: z.uuid(), status: z.literal("Sin resultados") }).strict(),
    z.object({
        queryId: z.uuid(),
        status: z.literal("Error"),
        errorCode: z.string().regex(/^[A-Z0-9_]{1,64}$/).optional()
    }).strict()
]);

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["Pendiente", "Respondida", "Sin resultados", "Error"]).optional()
}).strict();

module.exports = { createQuerySchema, callbackSchema, paginationSchema };
