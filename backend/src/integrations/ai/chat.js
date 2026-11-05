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
    return format?.type === "object" ? { type: "json_object" } : undefined;
}

async function generate(body) {
    validateChatInput(body);

    if (!env.OPENROUTER_API_KEY) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "OpenRouter no está configurado");
    }

    const requestBody = {
        model: env.OPENROUTER_CHAT_MODEL,
        messages: body.messages,
        temperature: body.options?.temperature ?? 0.2,
        max_tokens: body.options?.num_predict ?? 192,
        ...(jsonResponseFormat(body.format) ? { response_format: jsonResponseFormat(body.format) } : {})
    };

    let response;
    try {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${env.OPENROUTER_API_KEY}`
            },
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
        throw new ApiError(502, code, "El proveedor de IA rechazó la solicitud");
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "El proveedor de IA devolvió una respuesta inválida");
    }

    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "El proveedor de IA devolvió una respuesta inválida");
    }
    if (jsonResponseFormat(body.format) && choice.finish_reason === "length") {
        throw new ApiError(502, "AI_PROVIDER_INCOMPLETE_RESPONSE", "OpenRouter truncó la respuesta estructurada");
    }

    return { message: { content } };
}

module.exports = { generate, validateChatInput };
