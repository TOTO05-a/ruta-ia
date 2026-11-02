# RutaIA — diagnóstico y decisiones de implementación

Fecha: 2026-11-02

## Fuentes y autoridad

- El enunciado académico define los requisitos obligatorios y la rúbrica define los puntos de evaluación.
- El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Esta excepción se conserva; el resto del enunciado sigue vigente.
- El Registro de Decisiones define los acuerdos funcionales y visuales. La Especificación Técnica Maestra los convierte en contratos técnicos.
- Ninguna fuente afirma que las funcionalidades o integraciones ya estén implementadas.

## Diagnóstico y estado actualizado

- Local: rama activa `trabajo`; commit inicial `b1fdc2a`. Las ramas locales `main`, `dev` y `trabajo` siguen ese mismo commit. La sintaxis de 44 archivos JavaScript se verificó y 12/12 pruebas locales pasaron el 2026-11-02.
- GitHub: `TOTO05-a/ruta-ia` accesible y con las ramas `main`, `dev` y `trabajo` publicadas desde el commit inicial `b1fdc2a`.
- Notion: espacio de RutaIA, Registro de Decisiones y Especificación Técnica accesibles.
- Docker: CLI y Compose instalados, conexión al engine denegada; no se inspeccionaron ni modificaron contenedores. PostgreSQL, Qdrant, n8n y OpenRouter no están ejecutándose/alcanzables en los puertos locales observados.
- Catálogo institucional: no se encontró entre los archivos disponibles. No se fabricarán cursos institucionales para cumplir el mínimo de 20.

## Plan por ramas

- `main`: versión estable entregable.
- `dev`: integración de cambios revisados.
- `trabajo`: desarrollo activo de esta etapa.
- El commit inicial da una base común a las tres ramas. Continuar el trabajo de desarrollo en `trabajo`, integrar cambios revisados en `dev` y mantener `main` como línea estable.

## Trazabilidad de rúbrica

| Criterio | Puntos | Peso indicado | Trabajo y evidencia requerida |
| --- | ---: | ---: | --- |
| Dominio y conocimiento del código | 10 | 14.1% | Comprensión de módulos, explicación y flujo reproducible |
| Análisis, arquitectura y modelo de datos | 8 | 11.3% | Matriz de requisitos, ER y arquitectura |
| Base de datos relacional | 7 | 9.9% | Migraciones, restricciones, seeds autorizados y consultas |
| API REST (excepción aprobada: Express) | 8 | 11.3% | Endpoints, Swagger y pruebas HTTP |
| Qdrant y embeddings | 9 | 12.7% | Indexación, recuperación, payload, score y calibración |
| Automatización y RAG con n8n | 9 | 12.7% | Workflows y consulta fundamentada de extremo a extremo |
| Frontend e integración | 7 | 9.9% | Flujos de estudiante integrados y responsive |
| Validaciones y manejo de errores | 8 | 11.3% | Validaciones y estados de éxito/sin resultados/error |
| Documentación | 5 | 7.0% | README, diagramas, pruebas y presentación |

El total es 71 puntos. Los porcentajes mostrados suman 100.2% por redondeo individual a una décima; los pesos exactos se calculan respecto de 71 y suman 100%.

## Decisiones técnicas pendientes de evidencia

- Obtener autorización/fuente del catálogo institucional para cargar al menos 20 cursos detallados.
- Acceso al daemon Docker para inspeccionar recursos y arrancar servicios sin afectar contenedores ajenos.
- Confirmar modelos OpenRouter disponibles, dimensión de embedding y métrica Qdrant; calibrar score/umbral con casos del enunciado.
- Importar y verificar workflows n8n, modo callback y autenticación entre servicios.
- Definir configuración de sesión y aprovisionamiento seguro del primer administrador según el entorno disponible.
- Evaluar disponibilidad y retención de datos del proveedor/modelos OpenRouter antes de enviar preguntas reales de estudiantes.

## Estado de entregables

- `database/migrations/001_initial_schema.sql` y `docs/architecture/data-model.md`: **Implementado; pendiente de aplicar y verificar** en PostgreSQL.
- API Express, frontend, validaciones, manejo de errores, autenticación, contratos de callback, OpenAPI, README y diagramas: **Implementado en código; las rutas que dependen de PostgreSQL están pendientes de integración ejecutada**.
- Pruebas: **Probado localmente**, 12/12 pruebas `node --test`; sintaxis comprobada para 44 archivos JavaScript. No sustituye pruebas de integración.
- Docker Compose y Dockerfile: **Implementado como configuración, sintaxis validada con `docker compose config`; pendiente de arranque** porque el daemon no está disponible.
- Workflows `automation/n8n/index-courses.json` y `answer-query.json`: **Implementados como JSON; validación estática de JSON, conexiones y código JavaScript pasa; importación/credenciales/ejecución pendientes**.
- Exportaciones n8n de indexación y consulta: **Implementadas como JSON y validadas estáticamente**; credenciales, importación y ejecución pendientes.
- Qdrant, embeddings, n8n/RAG e integración real: **Pendiente de ejecución**; no se presentarán como probados.
- Mínimo de 20 cursos: **Bloqueado por falta de fuente institucional autorizada**.
- Umbral de similitud RAG: **Pendiente de calibración**; no hay valor arbitrario configurado.

## Excepción académica aprobada

El enunciado académico señala Java/Spring Boot. El usuario confirmó que el profesor autorizó Node.js/Express. Esta excepción reemplaza únicamente la tecnología del backend y se registra para trazabilidad; se conservan los demás requisitos del enunciado y la rúbrica. No es un bloqueo ni una propuesta técnica pendiente.
