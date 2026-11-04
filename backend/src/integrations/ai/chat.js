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

    const isOpenRouter = env.AI_PROVIDER === "openrouter";
    const baseUrl = isOpenRouter
        ? "https://openrouter.ai/api/v1/chat/completions"
        : `${env.OLLAMA_BASE_URL?.replace(/\/$/, "")}/api/chat`;
    if (!isOpenRouter && !env.OLLAMA_BASE_URL) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "El proveedor local de IA no está configurado");
    }
    if (isOpenRouter && !env.OPENROUTER_API_KEY) {
        throw new ApiError(503, "AI_PROVIDER_NOT_CONFIGURED", "OpenRouter no está configurado");
    }

    const requestBody = isOpenRouter
        ? {
            model: env.OPENROUTER_CHAT_MODEL,
            messages: body.messages,
            temperature: body.options?.temperature ?? 0.2,
            max_tokens: body.options?.num_predict ?? 192,
            ...(jsonResponseFormat(body.format) ? { response_format: jsonResponseFormat(body.format) } : {})
        }
        : {
            model: env.OLLAMA_CHAT_MODEL,
            stream: false,
            messages: body.messages,
            options: body.options ?? { temperature: 0.2, num_predict: 192 },
            ...(body.format ? { format: body.format } : {})
        };

    let response;
    try {
        response = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(isOpenRouter ? { authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {})
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(env.AI_CHAT_TIMEOUT_MS)
        });
    } catch (cause) {
        throw new ApiError(502, cause.name === "TimeoutError" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_UNAVAILABLE",
            "El proveedor de IA no respondió");
    }

    if (!response.ok) {
        throw new ApiError(502, "AI_PROVIDER_REJECTED_REQUEST", "El proveedor de IA rechazó la solicitud");
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "El proveedor de IA devolvió una respuesta inválida");
    }

    const content = isOpenRouter ? data?.choices?.[0]?.message?.content : data?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
        throw new ApiError(502, "AI_PROVIDER_INVALID_RESPONSE", "El proveedor de IA devolvió una respuesta inválida");
    }

    // Preserve Ollama's response shape so the current n8n validation node can consume either provider.
    return { message: { content } };
}

module.exports = { generate, validateChatInput };
