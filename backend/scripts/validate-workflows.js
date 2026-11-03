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

    totalNodes += workflow.nodes.length;
    console.log(`${file}: ${workflow.nodes.length} nodos, inactivo, JSON y conexiones válidos`);
}

console.log(`Validación completada: ${totalNodes} nodos, ${totalEdges} conexiones y ${totalCodeNodes} Code nodes compilables.`);
