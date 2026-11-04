const repository = require("../repositories/course.repository");
const env = require("../config/env");
const aiChat = require("../integrations/ai/chat");

async function activeCourses(req, res) {
    const items = await repository.listAllActive();
    return res.json({ data: { items, total: items.length } });
}

async function indexingConfig(req, res) {
    if (!env.OLLAMA_BASE_URL || !env.OLLAMA_EMBEDDING_MODEL || !env.QDRANT_URL) {
        return res.status(503).json({
            error: {
                code: "INDEXING_NOT_CONFIGURED",
                message: "La indexación no está configurada",
                requestId: req.requestId
            }
        });
    }
    return res.json({
        data: {
            embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
            ollamaBaseUrl: env.OLLAMA_BASE_URL,
            collection: env.QDRANT_COLLECTION,
            qdrantUrl: env.QDRANT_URL
        }
    });
}

async function generateChat(req, res) {
    const result = await aiChat.generate(req.body);
    return res.json(result);
}

module.exports = { activeCourses, indexingConfig, generateChat };
