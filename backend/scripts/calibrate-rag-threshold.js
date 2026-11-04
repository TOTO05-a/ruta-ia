#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../.env") });

const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
const model = process.env.OLLAMA_EMBEDDING_MODEL || "bge-m3";
const catalogUrl = process.env.CATALOG_URL || `http://localhost:${process.env.APP_PORT || 3000}/api/v1/courses?limit=100&page=1`;
const cases = [
    { expected: "Mecánica automotriz", query: "Busco aprender mecánica automotriz y reparación de motores de vehículos." },
    { expected: "Motocicletas", query: "Quiero estudiar mantenimiento y reparación de motocicletas." },
    { expected: "Gastronomía", query: "Me interesa cocina, preparación de alimentos y gastronomía." },
    { expected: "Refrigeración", query: "Busco formación en refrigeración y aire acondicionado." },
    { expected: "Electricidad", query: "Quiero aprender instalaciones eléctricas residenciales." },
    { expected: "Informática", query: "Me interesa informática, computación y soporte técnico." },
    { expected: "PLC", query: "Quiero aprender automatización industrial y programación de PLC." },
    { expected: "Datos", query: "Busco cursos de análisis de datos y bases de datos." },
    { expected: "Inteligencia artificial", query: "¿Qué puedo estudiar para trabajar con inteligencia artificial?" },
    { expected: null, query: "¿Qué requisitos necesito para estudiar medicina en la universidad?" },
    { expected: null, query: "Recomiéndame una receta de pastel de chocolate." },
    { expected: null, query: "Quiero aprender cocina italiana." },
    { expected: null, query: "¿Cuál es el pronóstico del clima para mañana?" },
    { expected: null, query: "Necesito consejos para reparar mi teléfono celular." },
    { expected: null, query: "¿Quién ganó el partido de fútbol de ayer?" },
    { expected: null, query: "Ayúdame a redactar una carta de renuncia." },
    { expected: null, query: "Busco una beca para estudiar en el extranjero." },
    { expected: null, query: "¿Cómo puedo mejorar mi dieta para bajar de peso?" },
    { expected: null, query: "Necesito encontrar trabajo en la ciudad." },
    { expected: null, query: "Explícame cómo invertir en criptomonedas." },
    { expected: null, query: "Quiero comprar una computadora portátil económica." },
    { expected: "Energía renovable", query: "¿Cómo se hace una instalación de paneles solares en casa?" }
];
const academicQueries = [
    "Quiero aprender a crear páginas web.",
    "Necesito aprender Java para trabajar con Spring Boot.",
    "Me interesa analizar datos y construir dashboards.",
    "Quiero automatizar procesos empresariales.",
    "¿Qué puedo estudiar para trabajar con inteligencia artificial?",
    "Quiero aprender a proteger aplicaciones web.",
    "Necesito desplegar aplicaciones usando contenedores."
];
const minSimilarity = Number(process.env.RAG_MIN_SIMILARITY || 0.535);

async function getJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}`);
    return response.json();
}

async function embed(text) {
    const result = await getJson(`${baseUrl}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: text })
    });
    const vector = result.embeddings?.[0];
    if (!Array.isArray(vector) || vector.length === 0 || vector.some((n) => !Number.isFinite(n))) {
        throw new Error("Ollama devolvió un embedding inválido");
    }
    return vector;
}

function cosine(a, b) {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
    }
    return dot / (Math.sqrt(aa) * Math.sqrt(bb));
}

function courseEmbeddingText(course) {
    // Keep this format byte-for-byte aligned with "Preparar textos de cursos"
    // in automation/n8n/index-courses.json so calibration matches Qdrant.
    return `Curso: ${course.name}\nDescripción: ${course.description}\nCategoría: ${course.category}\nNivel RutaIA: ${course.level}\nClasificación INTECAP: ${course.intecapCareerType ?? "No indicada"}\nDuración: ${course.durationHours} horas`;
}

async function main() {
    const catalog = await getJson(catalogUrl);
    const courses = Array.isArray(catalog.data) ? catalog.data : catalog.data?.items;
    if (!Array.isArray(courses)) throw new Error("La API de catálogo no devolvió data.items");
    if (courses.length < 3) throw new Error(`Se requieren al menos 3 cursos activos; catálogo recibido: ${courses.length}`);
    const courseVectors = [];
    for (const course of courses) {
        courseVectors.push({
            course,
            vector: await embed(courseEmbeddingText(course))
        });
    }
    const records = [];
    for (const testCase of cases) {
        const queryVector = await embed(testCase.query);
        const scored = courseVectors.map(({ course, vector }) => {
            if (vector.length !== queryVector.length) throw new Error("La dimensión de embedding del curso y consulta no coincide");
            return { course, score: cosine(queryVector, vector) };
        }).sort((a, b) => b.score - a.score);
        const matching = testCase.expected
            ? scored.filter(({ course }) => `${course.category || ""} ${course.name || ""}`.toLowerCase().includes(testCase.expected.toLowerCase()))
            : [];
        records.push({
            ...testCase,
            topScore: scored[0]?.score,
            thirdScore: scored[2]?.score,
            thirdRelevantScore: matching[2]?.score ?? null,
            topThreeNames: scored.slice(0, 3).map(({ course }) => course.name)
        });
    }
    const negatives = records.filter((r) => !r.expected);
    const positives = records.filter((r) => r.expected && r.thirdRelevantScore !== null);
    const maxOodThird = Math.max(...negatives.map((r) => r.thirdScore));
    const minRelevantThird = positives.length ? Math.min(...positives.map((r) => r.thirdRelevantScore)) : null;
    const academicCoverage = [];
    for (const query of academicQueries) {
        const queryVector = await embed(query);
        const scored = courseVectors.map(({ course, vector }) => {
            if (vector.length !== queryVector.length) throw new Error("La dimensión de embedding del curso y consulta no coincide");
            return { course, score: cosine(queryVector, vector) };
        }).sort((a, b) => b.score - a.score);
        const topFive = scored.slice(0, 5).map(({ course, score }) => ({
            courseId: course.id,
            name: course.name,
            category: course.category,
            score: Number(score.toFixed(4)),
            aboveThreshold: score >= minSimilarity
        }));
        academicCoverage.push({
            query,
            aboveThresholdCount: topFive.filter((result) => result.aboveThreshold).length,
            minimumSourcesForAnswer: 3,
            sufficientSources: topFive.filter((result) => result.aboveThreshold).length >= 3,
            topFive
        });
    }
    console.log(JSON.stringify({
        model, dimension: courseVectors[0].vector.length, courseCount: courses.length,
        caseCount: records.length, coveredPositiveCategories: positives.map((r) => r.expected),
        positiveCategoriesWithFewerThanThreeDirectCourses: records.filter((r) => r.expected && r.thirdRelevantScore === null).map((r) => r.expected),
        maxOutOfDomainThirdScore: Number(maxOodThird.toFixed(4)),
        minPositiveThirdRelevantScore: minRelevantThird === null ? null : Number(minRelevantThird.toFixed(4)),
        candidateThresholdWindow: minRelevantThird === null ? null : [Number(maxOodThird.toFixed(4)), Number(minRelevantThird.toFixed(4))],
        configuredMinimumSimilarity: minSimilarity,
        academicQueryCoverage: academicCoverage,
        cases: records
    }, null, 2));
}

main().catch((error) => {
    console.error(`No se pudo calibrar RAG: ${error.message}`);
    process.exitCode = 1;
});
