const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowDirectory = path.resolve(__dirname, "../../automation/n8n");
const files = ["index-courses.json", "sync-course-events.json", "answer-query.json"];
const expectedNodes = { "index-courses.json": 12, "sync-course-events.json": 13, "answer-query.json": 13 };
let totalNodes = 0;
let totalEdges = 0;
let totalCodeNodes = 0;

for (const file of files) {
    const filePath = path.join(workflowDirectory, file);
    const workflow = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(workflow.active, false, `${file} debe exportarse inactivo`);
    assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0, `${file} no contiene nodos`);
    assert.equal(workflow.nodes.length, expectedNodes[file], `${file} cambió su flujo simplificado esperado`);
    assert.ok(!JSON.stringify(workflow).includes("openrouter.ai"), `${file} no debe enviar datos a OpenRouter`);

    const names = new Set();
    const ids = new Set();
    for (const node of workflow.nodes) {
        assert.ok(node.name && !names.has(node.name), `${file} contiene nombre de nodo vacío o duplicado`);
        assert.ok(node.id && !ids.has(node.id), `${file} contiene ID de nodo vacío o duplicado`);
        names.add(node.name);
        ids.add(node.id);

        if (node.type === "n8n-nodes-base.code") {
            assert.equal(typeof node.parameters?.jsCode, "string", `${file}/${node.name} no contiene jsCode`);
            try {
                new Function(node.parameters.jsCode);
            } catch (error) {
                error.message = `${file}/${node.name}: ${error.message}`;
                throw error;
            }
            totalCodeNodes += 1;
        }
    }

    for (const [sourceName, outputGroups] of Object.entries(workflow.connections ?? {})) {
        assert.ok(names.has(sourceName), `${file} conecta un nodo de origen inexistente: ${sourceName}`);
        for (const outputs of Object.values(outputGroups)) {
            for (const branches of outputs) {
                for (const edge of branches) {
                    assert.ok(names.has(edge.node), `${file}/${sourceName} apunta a un nodo inexistente: ${edge.node}`);
                    totalEdges += 1;
                }
            }
        }
    }

    if (file === "index-courses.json") {
        const routes = workflow.connections ?? {};
        assert.ok(!workflow.nodes.some((node) => node.name === "Reconciliar cada 6 horas"),
            "la indexación completa debe quedar manual y no re-embebir el catálogo periódicamente");
        assert.equal(routes["Preparar textos de cursos"]?.main?.[0]?.[0]?.node, "¿Hay cursos activos para indexar?",
            "el catálogo debe decidir la ruta de indexación o limpieza");
        assert.equal(routes["¿Hay cursos activos para indexar?"]?.main?.[0]?.[0]?.node, "Generar embeddings vía Express",
            "los cursos disponibles deben continuar por embeddings");
        const embeddings = workflow.nodes.find((node) => node.name === "Generar embeddings vía Express");
        assert.equal(embeddings.parameters.url, "={{ $('Preparar textos de cursos').first().json.embeddingUrl }}",
            "la indexación debe usar el proxy autenticado de Express");
        assert.equal(embeddings.parameters.authentication, "genericCredentialType",
            "las solicitudes de embeddings deben autenticarse ante Express");
        assert.equal(embeddings.credentials?.httpHeaderAuth?.id, "e7f8c409-7ba0-4a21-8ef8-e1c29c88e6cf",
            "los embeddings deben reutilizar el secreto de sincronización guardado en n8n");
        assert.equal(routes["¿Hay cursos activos para indexar?"]?.main?.[1]?.[0]?.node, "Eliminar vectores de catálogo vacío",
            "un catálogo vacío debe limpiar Qdrant sin llamar al proveedor de embeddings");
        assert.equal(routes["Eliminar vectores de catálogo vacío"]?.main?.[0]?.[0]?.node, "Validar limpieza del catálogo vacío",
            "la limpieza debe distinguir colección inexistente de fallos reales de Qdrant");
        const obsoleteVectors = workflow.nodes.find((node) => node.name === "Eliminar puntos de cursos ya inactivos");
        assert.ok(!workflow.nodes.some((node) => node.name === "Preparar filtro de vectores obsoletos"),
            "el filtro de cursos activos debe construirse en la solicitud Qdrant");
        assert.equal(routes["Upsert idempotente en Qdrant"]?.main?.[0]?.[0]?.node, "Eliminar puntos de cursos ya inactivos",
            "la reconciliación debe eliminar puntos obsoletos después del upsert");
        assert.match(obsoleteVectors.parameters.url, /Preparar textos de cursos/);
        assert.match(obsoleteVectors.parameters.jsonBody, /courses\.map\(course => course\.id\)/);
    }

    if (file === "sync-course-events.json") {
        const nodes = new Map(workflow.nodes.map((node) => [node.name, node]));
        assert.ok(nodes.has("Revisar eventos pendientes"), "la sincronización incremental requiere su trigger opcional");
        assert.ok(nodes.has("Reclamar un evento") && nodes.has("Confirmar evento procesado"),
            "la sincronización incremental debe reclamar y confirmar eventos durables");
        assert.ok(!JSON.stringify(workflow).includes("rutaia_courses\""),
            "la automatización no debe apuntar a la colección antigua de 1024 dimensiones");
        assert.ok(JSON.stringify(workflow).includes("rutaia_courses_gemini_1536"),
            "la automatización debe limitar su destino a la colección nueva");
        assert.equal(nodes.get("Leer configuración incremental").parameters.url,
            "http://backend:3000/api/v1/internal/courses/sync-config");
        assert.equal(nodes.get("Reclamar un evento").parameters.url,
            "http://backend:3000/api/v1/internal/courses/sync-events/claim");
        assert.equal(nodes.get("Confirmar evento procesado").parameters.url,
            "http://backend:3000/api/v1/internal/courses/sync-events/ack");
        assert.equal(nodes.get("Embebir curso cambiado").credentials?.httpHeaderAuth?.id,
            "e7f8c409-7ba0-4a21-8ef8-e1c29c88e6cf",
            "los embeddings incrementales deben usar la credencial de sincronización");
    }

    if (file === "answer-query.json") {
        const routes = workflow.connections ?? {};
        const embedNode = workflow.nodes.find((node) => node.name === "Crear embedding de pregunta");
        const chatNode = workflow.nodes.find((node) => node.name === "Generar respuesta grounded");
        assert.equal(embedNode.parameters.url, "={{ $json.embeddingUrl }}",
            "la pregunta debe embebirse mediante el proxy autenticado de Express");
        assert.equal(embedNode.parameters.authentication, "genericCredentialType",
            "las solicitudes de embeddings deben autenticarse ante Express");
        assert.equal(embedNode.credentials?.httpHeaderAuth?.id, "e7f8c409-7ba0-4a21-8ef8-e1c29c88e6cf",
            "los embeddings deben reutilizar el secreto de sincronización guardado en n8n");
        assert.equal(chatNode.parameters.url, "http://backend:3000/api/v1/internal/ai/chat",
            "la generación debe pasar por el proxy autenticado de Express");
        assert.equal(chatNode.parameters.authentication, "genericCredentialType",
            "la generación debe autenticarse ante el proxy interno");
        assert.equal(chatNode.credentials?.httpHeaderAuth?.id, "e7f8c409-7ba0-4a21-8ef8-e1c29c88e6cf",
            "la generación debe reutilizar el secreto de sincronización guardado en n8n");
        assert.ok(!chatNode.parameters.jsonBody.includes("model: $json.chatModel"),
            "el modelo elegido debe quedar controlado por el backend y no por el workflow");
        assert.ok(chatNode.parameters.jsonBody.includes("additionalProperties: false") && chatNode.parameters.jsonBody.includes("required: ['answer', 'summary', 'explanation']"),
            "la solicitud de generación debe conservar el schema JSON requerido para la respuesta");
        assert.ok(chatNode.parameters.jsonBody.includes("num_predict: 192") &&
            chatNode.parameters.jsonBody.includes("answer máximo 55 palabras, summary máximo 18 y explanation máximo 25"),
            "la respuesta debe mantenerse breve para reducir timeouts y evitar truncar JSON");
        assert.ok(chatNode.parameters.jsonBody.includes("Solo las fuentes Qdrant recuperadas para la consulta actual son autoritativas") &&
            chatNode.parameters.jsonBody.includes("conversationHistory: $json.conversationHistory || []"),
            "la memoria conversacional no debe sustituir las fuentes Qdrant actuales");
        const qdrantNode = workflow.nodes.find((node) => node.name === "Buscar cinco cursos en Qdrant");
        assert.ok(qdrantNode.parameters.jsonBody.includes("key: 'category'") &&
            qdrantNode.parameters.jsonBody.includes("key: 'level'") &&
            qdrantNode.parameters.jsonBody.includes(": {})"),
            "los filtros opcionales de categoría y nivel deben omitirse cuando no se especifican");
        const filterNode = workflow.nodes.find((node) => node.name === "Filtrar fuentes activas y umbral");
        assert.match(filterNode.parameters.jsCode, /sort\(\(a,b\) => b\.similarity-a\.similarity\)\.slice\(0,3\)/,
            "el contexto RAG debe conservar solo las tres fuentes elegibles mejor clasificadas");
        assert.ok(!workflow.nodes.some((node) => node.name === "Preparar callback de error seguro"),
            "el callback de error seguro debe prepararse en el nodo HTTP");
        const errorCallback = workflow.nodes.find((node) => node.name === "Guardar estado de error");
        assert.match(errorCallback.parameters.jsonBody, /status: 'Error', errorCode: 'N8N_PROCESSING_ERROR'/);
        for (const node of workflow.nodes.filter((candidate) => candidate.onError === "continueErrorOutput")) {
            assert.equal(routes[node.name]?.main?.[1]?.[0]?.node, "Guardar estado de error",
                `${node.name} debe conservar el callback de error`);
        }
    }

    totalNodes += workflow.nodes.length;
    console.log(`${file}: ${workflow.nodes.length} nodos, inactivo, JSON y conexiones válidos`);
}

console.log(`Validación completada: ${totalNodes} nodos, ${totalEdges} conexiones y ${totalCodeNodes} Code nodes compilables.`);
assert.equal(totalNodes, 38, "los workflows deben mantener el total simplificado de nodos");
assert.equal(totalEdges, 43, "los workflows deben mantener todas sus conexiones");
assert.equal(totalCodeNodes, 11, "los workflows deben mantener el total simplificado de Code nodes");
