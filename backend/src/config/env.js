const { z } = require("zod");

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().default("http://localhost:3000"),
    SESSION_SECRET: z.string().min(32).optional(),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    N8N_QUERY_WEBHOOK_URL: z.string().url().optional(),
    N8N_WEBHOOK_SECRET: z.string().min(24).optional(),
    N8N_CALLBACK_URL: z.string().url().optional(),
    N8N_CALLBACK_SECRET: z.string().min(24).optional(),
    N8N_COURSE_SYNC_SECRET: z.string().min(24).optional(),
    N8N_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_EMBEDDING_MODEL: z.string().optional(),
    OPENROUTER_CHAT_MODEL: z.string().optional(),
    RAG_MIN_SIMILARITY: z.preprocess(
        (value) => value === "" || value === undefined ? undefined : value,
        z.coerce.number().min(-1).max(1).optional()
    ),
    QDRANT_URL: z.string().url().optional(),
    QDRANT_COLLECTION: z.string().min(1).default("rutaia_courses"),
    QDRANT_API_KEY: z.string().optional()
}).superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.SESSION_SECRET) {
        ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "es obligatorio en producción" });
    }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`);
    throw new Error(`Configuración inválida: ${issues.join("; ")}`);
}

module.exports = parsed.data;
