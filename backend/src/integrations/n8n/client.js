const env = require("../../config/env");

const GEMINI_COURSE_COLLECTION = "rutaia_courses_gemini_1536";

async function startQuery(payload) {
    if (!env.N8N_QUERY_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET || !env.N8N_CALLBACK_URL || !env.N8N_CALLBACK_SECRET) {
        const error = new Error("N8N_NOT_CONFIGURED");
        error.code = "N8N_NOT_CONFIGURED";
        throw error;
    }
    if (!env.GEMINI_API_KEY ||
        !env.QDRANT_URL || env.RAG_MIN_SIMILARITY === undefined) {
        const error = new Error("RAG_CONFIGURATION_MISSING");
        error.code = "RAG_CONFIGURATION_MISSING";
        throw error;
    }
    if (env.QDRANT_COLLECTION !== GEMINI_COURSE_COLLECTION) {
        const error = new Error("RAG_COLLECTION_NOT_CONFIGURED");
        error.code = "RAG_COLLECTION_NOT_CONFIGURED";
        throw error;
    }

    let response;
    try {
        response = await fetch(env.N8N_QUERY_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${env.N8N_WEBHOOK_SECRET}`
            },
            body: JSON.stringify({
                ...payload,
                callbackUrl: env.N8N_CALLBACK_URL,
                embeddingUrl: "http://backend:3000/api/v1/internal/ai/embeddings",
                minSimilarity: env.RAG_MIN_SIMILARITY,
                qdrantCollection: env.QDRANT_COLLECTION,
                qdrantUrl: env.QDRANT_URL
            }),
            signal: AbortSignal.timeout(env.N8N_TIMEOUT_MS)
        });
    } catch (cause) {
        const error = new Error(cause.name === "TimeoutError" ? "N8N_TIMEOUT" : "N8N_UNAVAILABLE");
        error.code = cause.name === "TimeoutError" ? "N8N_TIMEOUT" : "N8N_UNAVAILABLE";
        throw error;
    }

    if (!response.ok) {
        const error = new Error("N8N_REJECTED_REQUEST");
        error.code = `N8N_HTTP_${response.status}`;
        throw error;
    }
}

module.exports = { startQuery };
