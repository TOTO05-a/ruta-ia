const env = require("../../config/env");

async function startQuery(payload) {
    if (!env.N8N_QUERY_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET || !env.N8N_CALLBACK_URL || !env.N8N_CALLBACK_SECRET) {
        const error = new Error("N8N_NOT_CONFIGURED");
        error.code = "N8N_NOT_CONFIGURED";
        throw error;
    }
    if (!env.OPENROUTER_EMBEDDING_MODEL || !env.OPENROUTER_CHAT_MODEL || env.RAG_MIN_SIMILARITY === undefined) {
        const error = new Error("RAG_CONFIGURATION_MISSING");
        error.code = "RAG_CONFIGURATION_MISSING";
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
                embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
                chatModel: env.OPENROUTER_CHAT_MODEL,
                minSimilarity: env.RAG_MIN_SIMILARITY,
                qdrantCollection: env.QDRANT_COLLECTION
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
