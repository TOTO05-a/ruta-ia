# Arquitectura lógica de RutaIA

```mermaid
flowchart LR
  Student[Estudiante / Administrador] --> Browser[Frontend HTML CSS JavaScript]
  Browser -->|REST JSON| API[Node.js + Express]
  API -->|SQL parametrizado| PG[(PostgreSQL)]
  API -->|webhook autenticado| N8N[n8n]
  N8N -->|embeddings y respuesta local| O[Ollama en Windows]
  N8N -->|búsqueda semántica| QD[(Qdrant)]
  N8N -->|resultado autenticado| API
```

## Límites

- El navegador consume exclusivamente Express; nunca conecta directamente a PostgreSQL, n8n, Qdrant u Ollama.
- PostgreSQL determina si cada curso existe y está activo antes de persistirlo como fuente.
- n8n envía el texto de cursos y las preguntas a Ollama local mediante `host.docker.internal:11434`; no se usan proveedores remotos de modelos ni una clave externa.
- El flujo debe guardar primero una consulta `Pendiente` y terminarla como `Respondida`, `Sin resultados` o `Error`.

Este diagrama describe la topología aprobada. En la última comprobación, Docker Compose mostró cuatro servicios saludables y n8n alcanzó Ollama. Tras añadir los cuatro cursos del seed 006, la indexación real dejó 24 puntos. El workflow activo de consulta usa Ollama. La prueba E2E anterior con umbral `0.535` terminó en `Sin resultados` para cocina italiana y `Respondida` para gastronomía, con cuatro fuentes oficiales, historial y rating HTTP 201; los datos de prueba se limpiaron. Una corrida anterior agotó 300 s, lo que muestra variabilidad en la inferencia local. Sigue pendiente la inspección visual autenticada: Work Settings todavía deshabilita el control del navegador local.
