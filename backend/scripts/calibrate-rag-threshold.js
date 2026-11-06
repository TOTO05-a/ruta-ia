#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: require("node:path").resolve(__dirname, "../../.env") });

const apiBaseUrl = (process.env.RUTAIA_API_URL || `http://localhost:${process.env.APP_PORT || 3001}/api/v1`).replace(/\/$/, "");
const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
const catalogUrl = process.env.CATALOG_URL || `${apiBaseUrl}/courses?limit=100&page=1`;
const syncSecret = process.env.N8N_COURSE_SYNC_SECRET || "";
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
function readMinimumSimilarity(value) {
    if (value === undefined || value === "") return null;
    const threshold = Number(value);
    if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
        throw new Error("RAG_MIN_SIMILARITY debe ser un número entre -1 y 1");
    }
    return threshold;
}

const minSimilarity = readMinimumSimilarity(process.env.RAG_MIN_SIMILARITY);

async function getJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${url} respondió HTTP ${response.status}`);
    return response.json();
}

async function embed(inputs, task) {
    if (!syncSecret) throw new Error("N8N_COURSE_SYNC_SECRET es obligatorio para solicitar embeddings al proxy local");
    if (!["document", "query"].includes(task)) throw new Error("La tarea de embeddings debe ser document o query");
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 100) {
        throw new Error("El lote de calibración debe contener entre 1 y 100 textos");
    }
    const vectors = [];
    for (let start = 0; start < inputs.length; start += 2) {
        const batch = inputs.slice(start, start + 2);
        let response;
        let responseErrorCode;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            response = await fetch(`${apiBaseUrl}/internal/ai/embeddings`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-n8n-sync-secret": syncSecret },
                body: JSON.stringify({ input: batch, task }),
                signal: AbortSignal.timeout(Number(process.env.AI_CALIBRATION_TIMEOUT_MS || 900_000))
            });
            if (response.ok) break;
            try {
                responseErrorCode = (await response.json())?.error?.code;
            } catch {
                responseErrorCode = undefined;
            }
            if (responseErrorCode === "AI_PROVIDER_RATE_LIMITED" || response.status !== 502 || attempt === 2) break;
            await new Promise((resolve) => setTimeout(resolve, 1500 * (2 ** attempt)));
        }
        if (!response.ok) {
            if (responseErrorCode === "AI_PROVIDER_RATE_LIMITED") {
                throw new Error("Gemini limitó las solicitudes; espera antes de reintentar la calibración");
            }
            throw new Error(`El proxy de embeddings respondió HTTP ${response.status} para las entradas ${start + 1}-${start + batch.length}`);
        }
        const result = await response.json();
        const batchVectors = result.embeddings;
        const dimension = batchVectors?.[0]?.length;
        if (!Array.isArray(batchVectors) || batchVectors.length !== batch.length ||
            !Number.isInteger(dimension) || dimension < 1 ||
            batchVectors.some((vector) => !Array.isArray(vector) || vector.length !== dimension || vector.some((n) => !Number.isFinite(n)))) {
            throw new Error(`Gemini devolvió embeddings inválidos para las entradas ${start + 1}-${start + batch.length}`);
        }
        vectors.push(...batchVectors);
    }
    return vectors;
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
    const courseInputs = courses.map(courseEmbeddingText);
    const queryInputs = [...cases.map(({ query }) => query), ...academicQueries];
    if (courseInputs.length + queryInputs.length > 100) {
        throw new Error("El catálogo y los casos exceden el límite de 100 textos por calibración");
    }
    const courseEmbeddings = await embed(courseInputs, "document");
    const queryEmbeddings = await embed(queryInputs, "query");
    if (courseEmbeddings.length !== courseInputs.length || queryEmbeddings.length !== queryInputs.length) {
        throw new Error("La cantidad de embeddings devuelta no coincide con las entradas");
    }
    const courseVectors = courses.map((course, index) => ({ course, vector: courseEmbeddings[index] }));
    let embeddingIndex = 0;
    const records = [];
    for (const testCase of cases) {
        const queryVector = queryEmbeddings[embeddingIndex++];
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
        const queryVector = queryEmbeddings[embeddingIndex++];
        const scored = courseVectors.map(({ course, vector }) => {
            if (vector.length !== queryVector.length) throw new Error("La dimensión de embedding del curso y consulta no coincide");
            return { course, score: cosine(queryVector, vector) };
        }).sort((a, b) => b.score - a.score);
        const topFive = scored.slice(0, 5).map(({ course, score }) => ({
            courseId: course.id,
            name: course.name,
            category: course.category,
            score: Number(score.toFixed(4)),
            aboveThreshold: minSimilarity === null ? null : score >= minSimilarity
        }));
        academicCoverage.push({
            query,
            aboveThresholdCount: minSimilarity === null ? null : topFive.filter((result) => result.aboveThreshold).length,
            minimumSourcesForAnswer: 3,
            sufficientSources: minSimilarity === null ? null : topFive.filter((result) => result.aboveThreshold).length >= 3,
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

if (require.main === module) {
    main().catch((error) => {
        console.error(`No se pudo calibrar RAG: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = { embed, readMinimumSimilarity };
