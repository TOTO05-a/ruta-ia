# RutaIA — diagnóstico y decisiones de implementación

Fecha: 2026-11-02

## Fuentes y autoridad

- El enunciado académico define los requisitos obligatorios y la rúbrica define los puntos de evaluación.
- El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Esta excepción se conserva; el resto del enunciado sigue vigente.
- El Registro de Decisiones define los acuerdos funcionales y visuales. La Especificación Técnica Maestra los convierte en contratos técnicos.
- Ninguna fuente afirma que las funcionalidades o integraciones ya estén implementadas.

## Diagnóstico y estado actualizado

- Local: rama activa `trabajo`, limpia tras el último commit. `main` y `dev` permanecen en el commit estable inicial a la espera de revisión/integración. La sintaxis de los 48 archivos JavaScript se verificó; 12 pruebas unitarias/HTTP pasan y la prueba optativa de integración PostgreSQL pasa (1/1), incluidas dos ejecuciones consecutivas.
- GitHub: `TOTO05-a/ruta-ia` accesible; las ramas `main`, `dev` y `trabajo` están publicadas. Desarrollo continúa en `trabajo`.
- Notion: espacio de RutaIA, Registro de Decisiones y Especificación Técnica accesibles.
- Docker: inspección del daemon Linux 29.8.2 confirmó PostgreSQL, Qdrant, n8n y backend RutaIA healthy (puertos locales 5432, 6333, 5678 y 3001). Home Assistant sigue activo y no se alteró; MongoDB preexistente permanece detenido y sin cambios. App accesible en `http://localhost:3001`.
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
- Confirmar modelos OpenRouter disponibles, dimensión de embedding y métrica Qdrant; calibrar score/umbral con casos del enunciado.
- Configurar credenciales y probar workflows importados en n8n; verificar modo callback y autenticación entre servicios.
- Definir configuración de sesión y aprovisionamiento seguro del primer administrador según el entorno disponible.
- Evaluar disponibilidad y retención de datos del proveedor/modelos OpenRouter antes de enviar preguntas reales de estudiantes.

## Estado de entregables

- `database/migrations/001_initial_schema.sql` y `docs/architecture/data-model.md`: **Aplicado en PostgreSQL limpio**; versión de migración y ocho tablas públicas verificadas.
- API Express, frontend, validaciones, manejo de errores, autenticación, contratos de callback, OpenAPI, README y diagramas: **Implementado**; registro HTTP 201 y `/auth/me` probados con PostgreSQL real. Flujos adicionales de DB siguen pendientes.
- Pruebas: **Probado localmente**, 12/12 pruebas unitarias/HTTP, integración PostgreSQL aislada 1/1 y sintaxis comprobada para 48 archivos JavaScript.
- Docker Compose y Dockerfile: **Arrancados y verificados**; PostgreSQL/Qdrant/n8n/API healthy.
- Workflows `automation/n8n/index-courses.json` y `answer-query.json`: **Validados estáticamente e importados** en n8n 2.46.4, ambos inactivos; credenciales/modelos/ejecución pendientes.
- Qdrant responde pero no tiene colección; embeddings/OpenRouter y RAG de extremo a extremo: **Pendientes de ejecución**; no se presentarán como probados.
- Mínimo de 20 cursos: **Bloqueado por falta de fuente institucional autorizada**.
- Umbral de similitud RAG: **Pendiente de calibración**; no hay valor arbitrario configurado.

## Excepción académica aprobada

El enunciado académico señala Java/Spring Boot. El usuario confirmó que el profesor autorizó Node.js/Express. Esta excepción reemplaza únicamente la tecnología del backend y se registra para trazabilidad; se conservan los demás requisitos del enunciado y la rúbrica. No es un bloqueo ni una propuesta técnica pendiente.
