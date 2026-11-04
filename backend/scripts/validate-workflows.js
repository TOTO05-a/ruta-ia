const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowDirectory = path.resolve(__dirname, "../../automation/n8n");
const files = ["index-courses.json", "answer-query.json"];
let totalNodes = 0;
let totalEdges = 0;
let totalCodeNodes = 0;

for (const file of files) {
    const filePath = path.join(workflowDirectory, file);
    const workflow = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.equal(workflow.active, false, `${file} debe exportarse inactivo`);
    assert.ok(Array.isArray(workflow.nodes) && workflow.nodes.length > 0, `${file} no contiene nodos`);
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
        assert.equal(routes["Preparar textos de cursos"]?.main?.[0]?.[0]?.node, "¿Hay cursos activos para indexar?",
            "el catálogo debe decidir la ruta de indexación o limpieza");
        assert.equal(routes["¿Hay cursos activos para indexar?"]?.main?.[0]?.[0]?.node, "Generar embeddings Ollama",
            "los cursos disponibles deben continuar por embeddings");
        const embeddings = workflow.nodes.find((node) => node.name === "Generar embeddings Ollama");
        assert.equal(embeddings.parameters.url, "={{ $('Preparar textos de cursos').first().json.ollamaBaseUrl.replace(/\\/$/, '') + '/api/embed' }}",
            "la indexación debe usar Ollama local");
        assert.equal(routes["¿Hay cursos activos para indexar?"]?.main?.[1]?.[0]?.node, "Eliminar vectores de catálogo vacío",
            "un catálogo vacío debe limpiar Qdrant sin llamar al proveedor de embeddings");
        assert.equal(routes["Eliminar vectores de catálogo vacío"]?.main?.[0]?.[0]?.node, "Validar limpieza del catálogo vacío",
            "la limpieza debe distinguir colección inexistente de fallos reales de Qdrant");
    }

    if (file === "answer-query.json") {
        const embedNode = workflow.nodes.find((node) => node.name === "Crear embedding de pregunta");
        const chatNode = workflow.nodes.find((node) => node.name === "Generar respuesta grounded");
        assert.equal(embedNode.parameters.url, "={{ $json.ollamaBaseUrl.replace(/\\/$/, '') + '/api/embed' }}",
            "la pregunta debe embebirse con Ollama local");
        assert.equal(chatNode.parameters.url, "={{ $('Webhook autenticado de consulta').first().json.body.ollamaBaseUrl.replace(/\\/$/, '') + '/api/chat' }}",
            "la generación debe usar Ollama local");
        assert.ok(chatNode.parameters.jsonBody.includes("additionalProperties: false") && chatNode.parameters.jsonBody.includes("required: ['answer', 'summary', 'explanation']"),
            "Ollama debe recibir el schema JSON requerido para la respuesta");
        assert.ok(chatNode.parameters.jsonBody.includes("num_predict: 192") &&
            chatNode.parameters.jsonBody.includes("answer máximo 55 palabras, summary máximo 18 y explanation máximo 25"),
            "la respuesta local debe mantenerse breve para evitar exceder el tiempo de generación y truncar JSON");
        const filterNode = workflow.nodes.find((node) => node.name === "Filtrar fuentes activas y umbral");
        assert.match(filterNode.parameters.jsCode, /sort\(\(a,b\) => b\.similarity-a\.similarity\)\.slice\(0,3\)/,
            "el contexto RAG debe conservar solo las tres fuentes elegibles mejor clasificadas");
    }

    totalNodes += workflow.nodes.length;
    console.log(`${file}: ${workflow.nodes.length} nodos, inactivo, JSON y conexiones válidos`);
}

console.log(`Validación completada: ${totalNodes} nodos, ${totalEdges} conexiones y ${totalCodeNodes} Code nodes compilables.`);
