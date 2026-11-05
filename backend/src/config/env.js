const { z } = require("zod");

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    OPENROUTER_API_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
    OPENROUTER_CHAT_MODEL: z.string().default("openrouter/free"),
    OPENROUTER_EMBEDDING_MODEL: z.string().default("nvidia/nemotron-3.5-embed-1b:free"),
    AI_CHAT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180_000).default(120_000),
    AI_EMBEDDING_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180_000).default(60_000),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().default("http://localhost:3000"),
    SESSION_SECRET: z.string().min(32).optional(),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    JWT_SECRET: z.preprocess((value) => value === "" ? undefined : value, z.string().min(32).optional()),
    JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(3600),
    N8N_QUERY_WEBHOOK_URL: z.string().url().optional(),
    N8N_WEBHOOK_SECRET: z.string().min(24).optional(),
    N8N_CALLBACK_URL: z.string().url().optional(),
    N8N_CALLBACK_SECRET: z.string().min(24).optional(),
    N8N_COURSE_SYNC_SECRET: z.string().min(24).optional(),
    N8N_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60_000).default(10_000),
    RAG_MIN_SIMILARITY: z.preprocess(
        (value) => value === "" || value === undefined ? undefined : value,
        z.coerce.number().min(-1).max(1).optional()
    ),
    QDRANT_URL: z.string().url().optional(),
    QDRANT_COLLECTION: z.string().min(1).default("rutaia_courses_openrouter_2048")
}).superRefine((value, ctx) => {
    if (value.OPENROUTER_CHAT_MODEL !== "openrouter/free" && !/:free$/.test(value.OPENROUTER_CHAT_MODEL)) {
        ctx.addIssue({ code: "custom", path: ["OPENROUTER_CHAT_MODEL"], message: "solo se permiten openrouter/free o IDs terminados en :free para evitar modelos con costo" });
    }
    if (!/:free$/.test(value.OPENROUTER_EMBEDDING_MODEL)) {
        ctx.addIssue({ code: "custom", path: ["OPENROUTER_EMBEDDING_MODEL"], message: "solo se permiten modelos de embeddings gratuitos terminados en :free" });
    }
    if (value.NODE_ENV === "production" && !value.SESSION_SECRET) {
        ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "es obligatorio en producción" });
    }
    if (value.JWT_SECRET && value.JWT_SECRET === value.SESSION_SECRET) {
        ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "debe ser distinto de SESSION_SECRET" });
    }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues.map(({ path, message }) => `${path.join(".")}: ${message}`);
    throw new Error(`Configuración inválida: ${issues.join("; ")}`);
}

module.exports = parsed.data;
