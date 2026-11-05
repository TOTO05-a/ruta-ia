const env = require("../../config/env");
const ApiError = require("../../utils/api-error");

const MAX_BATCH_SIZE = 100;
const MAX_TOTAL_CHARACTERS = 500_000;
const PROVIDER_BATCH_SIZE = 2;
const MAX_PROVIDER_ATTEMPTS = 3;

function validateEmbeddingInput(body) {
    const input = body?.input;
    const inputs = typeof input === "string" ? [input] : input;
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > MAX_BATCH_SIZE ||
        inputs.some((item) => typeof item !== "string" || !item.trim())) {
        throw new ApiError(400, "AI_EMBEDDING_INVALID_INPUT", "La solicitud de embeddings no es válida");
    }
    if (inputs.reduce((total, item) => total + item.length, 0) > MAX_TOTAL_CHARACTERS) {
        throw new ApiError(413, "AI_EMBEDDING_INPUT_TOO_LARGE", "El lote de embeddings excede el límite permitido");
    }
    return inputs;
}

async function requestProviderBatch(batch) {
    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
        let response;
        try {
            response = await fetch("https://openrouter.ai/api/v1/embeddings", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${env.OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model: env.OPENROUTER_EMBEDDING_MODEL,
                    input: batch
                }),
                signal: AbortSignal.timeout(env.AI_EMBEDDING_TIMEOUT_MS)
            });
        } catch (cause) {
            if (attempt + 1 < MAX_PROVIDER_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
                continue;
            }
            throw new ApiError(502, cause.name === "TimeoutError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE",
                "El proveedor de embeddings no respondió");
        }

        if (!response.ok) {
            if (response.status === 400 && batch.length > 1) {
                throw new ApiError(502, "AI_PROVIDER_BATCH_REJECTED", "OpenRouter rechazó el lote de embeddings");
            }
            if (response.status >= 500 && attempt + 1 < MAX_PROVIDER_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
                continue;
            }
            const code = response.status === 429 ? "AI_PROVIDER_RATE_LIMITED" :
                response.status >= 500 ? "AI_PROVIDER_UNAVAILABLE" : "AI_PROVIDER_REJECTED_REQUEST";
            throw new ApiError(502, code, "OpenRouter no pudo generar embeddings");
        }

        let data;
        try {
            data = await response.json();
        } catch {
            throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "OpenRouter devolvió embeddings inválidos");
        }
        return data?.data;
    }
    throw new ApiError(502, "AI_PROVIDER_UNAVAILABLE", "OpenRouter no pudo generar embeddings");
}

async function requestProviderEmbeddings(batch) {
    try {
        return await requestProviderBatch(batch);
    } catch (error) {
        if (error.code !== "AI_PROVIDER_BATCH_REJECTED") throw error;

        const items = [];
        for (const [index, input] of batch.entries()) {
            const singleItems = await requestProviderBatch([input]);
            if (!Array.isArray(singleItems) || singleItems.length !== 1) {
                throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "OpenRouter devolvió una cantidad de embeddings inválida");
            }
            items.push({ index, embedding: singleItems[0]?.embedding });
        }
        return items;
    }
}

async function generate(body) {
    const inputs = validateEmbeddingInput(body);
    if (!env.OPENROUTER_API_KEY) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "OpenRouter no está configurado");
    }

    const ordered = [];
    let dimension;
    for (let start = 0; start < inputs.length; start += PROVIDER_BATCH_SIZE) {
        const batch = inputs.slice(start, start + PROVIDER_BATCH_SIZE);
        const items = await requestProviderEmbeddings(batch);
        if (!Array.isArray(items) || items.length !== batch.length) {
            throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "OpenRouter devolvió una cantidad de embeddings inválida");
        }
        const batchVectors = Array(batch.length);
        for (const [fallbackIndex, item] of items.entries()) {
            const index = item?.index === undefined ? fallbackIndex : item.index;
            const vector = item?.embedding;
            if (!Number.isInteger(index) || index < 0 || index >= batch.length || batchVectors[index] ||
                !Array.isArray(vector) || vector.length < 1 || vector.some((value) => !Number.isFinite(value))) {
                throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "OpenRouter devolvió embeddings inválidos");
            }
            batchVectors[index] = vector;
        }
        const batchDimension = batchVectors[0]?.length;
        if (!Number.isInteger(batchDimension) || batchVectors.some((vector) => !vector || vector.length !== batchDimension) ||
            (dimension !== undefined && dimension !== batchDimension)) {
            throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "OpenRouter devolvió dimensiones de embeddings inconsistentes");
        }
        dimension = batchDimension;
        ordered.push(...batchVectors);
    }

    return { embeddings: ordered };
}

module.exports = { generate, validateEmbeddingInput };
