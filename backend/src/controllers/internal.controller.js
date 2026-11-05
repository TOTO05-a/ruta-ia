const repository = require("../repositories/course.repository");
const env = require("../config/env");
const aiChat = require("../integrations/ai/chat");
const aiEmbeddings = require("../integrations/ai/embeddings");
const courseSyncOutbox = require("../repositories/course-sync-outbox.repository");

const OPENROUTER_COURSE_COLLECTION = "rutaia_courses_openrouter_2048";

async function activeCourses(req, res) {
    const items = await repository.listAllActive();
    return res.json({ data: { items, total: items.length } });
}

async function indexingConfig(req, res) {
    if (!env.OPENROUTER_EMBEDDING_MODEL || !env.QDRANT_URL ||
        env.QDRANT_COLLECTION !== OPENROUTER_COURSE_COLLECTION) {
        return res.status(503).json({
            error: {
                code: "INDEXING_NOT_CONFIGURED",
                message: "La indexación requiere la colección OpenRouter de 2048 dimensiones",
                requestId: req.requestId
            }
        });
    }
    return res.json({
        data: {
            embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
            embeddingUrl: "http://backend:3000/api/v1/internal/ai/embeddings",
            collection: env.QDRANT_COLLECTION,
            qdrantUrl: env.QDRANT_URL
        }
    });
}

async function courseSyncConfig(req, res) {
    if (!env.OPENROUTER_EMBEDDING_MODEL || !env.QDRANT_URL ||
        env.QDRANT_COLLECTION !== OPENROUTER_COURSE_COLLECTION) {
        return res.status(503).json({
            error: {
                code: "COURSE_SYNC_NOT_CONFIGURED",
                message: "La sincronización incremental requiere la colección configurada de 2048 dimensiones",
                requestId: req.requestId
            }
        });
    }
    return res.json({
        data: {
            embeddingUrl: "http://backend:3000/api/v1/internal/ai/embeddings",
            collection: OPENROUTER_COURSE_COLLECTION,
            dimension: 2048,
            qdrantUrl: env.QDRANT_URL
        }
    });
}

async function claimCourseSyncEvents(req, res) {
    const events = await courseSyncOutbox.claimPending(1);
    return res.json({ data: { event: events[0] || null } });
}

async function acknowledgeCourseSyncEvent(req, res) {
    const { id, version } = req.body || {};
    if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(version)) || Number(version) < 1) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "El evento de sincronización no es válido",
                requestId: req.requestId
            }
        });
    }
    const acknowledged = await courseSyncOutbox.acknowledge(String(id), Number(version));
    return res.json({ data: { acknowledged } });
}

async function generateChat(req, res) {
    const result = await aiChat.generate(req.body);
    return res.json(result);
}

async function generateEmbeddings(req, res) {
    const result = await aiEmbeddings.generate(req.body);
    return res.json(result);
}

module.exports = {
    activeCourses, indexingConfig, courseSyncConfig, claimCourseSyncEvents,
    acknowledgeCourseSyncEvent, generateChat, generateEmbeddings
};
