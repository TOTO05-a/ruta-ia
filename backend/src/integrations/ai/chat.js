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

async function generate(body) {
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

module.exports = { generate, validateChatInput };
