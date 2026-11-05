const HEADERS = ["Fecha", "Estado", "Pregunta", "Respuesta", "Resumen", "Explicación", "Cursos recomendados"];
const COLUMNS = ["createdAt", "status", "question", "answer", "summary", "explanation", "sources"];

function escapeCell(value) {
    const text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
    const safeText = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
}

function toCsv(records) {
    const rows = [HEADERS, ...records.map((record) => COLUMNS.map((column) => record[column]))];
    return `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
}

module.exports = { toCsv };
