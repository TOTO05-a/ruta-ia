const env = require("../../config/env");
const ApiError = require("../../utils/api-error");

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

function validateChatInput(body) {
    if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
        throw new ApiError(400, "AI_CHAT_INVALID_INPUT", "La solicitud de generación no es válida");
    }
    let totalCharacters = 0;
    for (const message of body.messages) {
        if (!message || !ALLOWED_ROLES.has(message.role) || typeof message.content !== "string" || !message.content.trim()) {
            throw new ApiError(400, "AI_CHAT_INVALID_INPUT", "La solicitud de generación no es válida");
        }
        totalCharacters += message.content.length;
    }
    if (totalCharacters > 24_000) {
        throw new ApiError(413, "AI_CHAT_INPUT_TOO_LARGE", "El contexto de generación excede el límite permitido");
    }
    return body;
}

function jsonResponseFormat(format) {
    return format?.type === "object";
}

async function generateChat(body) {
    validateChatInput(body);
    if (!env.GEMINI_API_KEY) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "Gemini no está configurado");
    }

    const systemMessages = body.messages.filter((message) => message.role === "system").map((message) => message.content);
    const contents = body.messages.filter((message) => message.role !== "system").map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
    }));
    if (contents.length === 0) {
        throw new ApiError(400, "AI_CHAT_INVALID_INPUT", "La solicitud de generación no es válida");
    }

    const requestBody = {
        ...(systemMessages.length ? { systemInstruction: { parts: [{ text: systemMessages.join("\n\n") }] } } : {}),
        contents,
        generationConfig: {
            temperature: body.options?.temperature ?? 0.2,
            maxOutputTokens: body.options?.num_predict ?? 192,
            ...(jsonResponseFormat(body.format) ? { responseMimeType: "application/json" } : {})
        }
    };

    let response;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_CHAT_MODEL}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(env.AI_CHAT_TIMEOUT_MS)
        });
    } catch (cause) {
        throw new ApiError(502, cause.name === "TimeoutError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE",
            "El proveedor de IA no respondió");
    }

    if (!response.ok) {
        const code = response.status === 429 ? "AI_PROVIDER_RATE_LIMITED" :
            response.status >= 500 ? "AI_PROVIDER_UNAVAILABLE" : "AI_PROVIDER_REJECTED_REQUEST";
        throw new ApiError(502, code, "Gemini rechazó la solicitud");
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "Gemini devolvió una respuesta inválida");
    }

    const candidate = data?.candidates?.[0];
    const content = candidate?.content?.parts?.map((part) => part.text ?? "").join("");
    if (typeof content !== "string" || !content.trim()) {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "Gemini devolvió una respuesta inválida");
    }
    if (jsonResponseFormat(body.format) && candidate.finishReason === "MAX_TOKENS") {
        throw new ApiError(502, "AI_PROVIDER_INCOMPLETE_RESPONSE", "Gemini truncó la respuesta estructurada");
    }
    return { message: { content } };
}

const MAX_BATCH_SIZE = 100;
const MAX_TOTAL_CHARACTERS = 500_000;
const PROVIDER_BATCH_SIZE = 2;
const MAX_PROVIDER_ATTEMPTS = 3;
const TASK_PREFIX = {
    document: (text) => `title: none | text: ${text}`,
    query: (text) => `task: question answering | query: ${text}`
};

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

async function requestEmbedding(text) {
    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
        let response;
        try {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBEDDING_MODEL}:embedContent`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
                body: JSON.stringify({
                    content: { parts: [{ text }] },
                    outputDimensionality: env.GEMINI_EMBEDDING_DIMENSIONS
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
            if (response.status >= 500 && attempt + 1 < MAX_PROVIDER_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
                continue;
            }
            const code = response.status === 429 ? "AI_PROVIDER_RATE_LIMITED" :
                response.status >= 500 ? "AI_PROVIDER_UNAVAILABLE" : "AI_PROVIDER_REJECTED_REQUEST";
            throw new ApiError(502, code, "Gemini no pudo generar embeddings");
        }

        let data;
        try {
            data = await response.json();
        } catch {
            throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "Gemini devolvió embeddings inválidos");
        }
        const vector = data?.embedding?.values;
        if (!Array.isArray(vector) || vector.length !== env.GEMINI_EMBEDDING_DIMENSIONS ||
            vector.some((value) => !Number.isFinite(value))) {
            throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "Gemini devolvió embeddings inválidos");
        }
        return vector;
    }
    throw new ApiError(502, "AI_PROVIDER_UNAVAILABLE", "Gemini no pudo generar embeddings");
}

async function generateEmbeddings(body) {
    const inputs = validateEmbeddingInput(body);
    const task = body.task ?? "document";
    if (!Object.hasOwn(TASK_PREFIX, task)) {
        throw new ApiError(400, "AI_EMBEDDING_INVALID_INPUT", "La tarea de embeddings no es válida");
    }
    if (!env.GEMINI_API_KEY) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "Gemini no está configurado");
    }

    const prefixedInputs = inputs.map(TASK_PREFIX[task]);
    const embeddings = [];
    for (let start = 0; start < prefixedInputs.length; start += PROVIDER_BATCH_SIZE) {
        const batch = prefixedInputs.slice(start, start + PROVIDER_BATCH_SIZE);
        embeddings.push(...await Promise.all(batch.map(requestEmbedding)));
    }
    return { embeddings };
}

module.exports = { generateChat, validateChatInput, generateEmbeddings, validateEmbeddingInput };
