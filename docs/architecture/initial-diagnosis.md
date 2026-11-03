# RutaIA — diagnóstico y decisiones de implementación

Fecha: 2026-11-02

## Fuentes y autoridad

- El enunciado académico define los requisitos obligatorios y la rúbrica define los puntos de evaluación.
- El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Esta excepción se conserva; el resto del enunciado sigue vigente.
- El Registro de Decisiones define los acuerdos funcionales y visuales. La Especificación Técnica Maestra los convierte en contratos técnicos.
- Ninguna fuente afirma que las funcionalidades o integraciones ya estén implementadas.

## Diagnóstico y estado actualizado

- Local: rama activa `trabajo`, limpia al inicio de este diagnóstico; `trabajo` y `dev` apuntan a `21a26ad`, y `main` permanece en `b1fdc2a` como línea estable. La suite unitaria/HTTP se repitió en esta sesión: 12 pasan, 0 fallan y 1 prueba optativa de integración se omite. En un intento inicial el sandbox bloqueó sockets loopback; la repetición autorizada localmente completó correctamente.
- GitHub: `TOTO05-a/ruta-ia` accesible; las ramas `main`, `dev` y `trabajo` están publicadas. Desarrollo continúa en `trabajo`.
- Notion: espacio de RutaIA, Registro de Decisiones y Especificación Técnica accesibles.
- Docker: inspección de solo lectura del daemon Linux confirmó PostgreSQL, Qdrant, n8n y backend RutaIA healthy (puertos locales 5432, 6333, 5678 y 3001); Home Assistant sigue activo. MongoDB no aparece entre los contenedores en ejecución; no se modificó ningún contenedor. App accesible en `http://localhost:3001`.
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
- Baseline seleccionado desde el catálogo OpenRouter: `baai/bge-m3` (1024 dimensiones) y `meta-llama/llama-3.3-70b-instruct`. La fuente exige ZDR y `data_collection=deny`; falta verificar endpoints elegibles con credencial, autorizar transferencia de datos y calibrar score/umbral con el catálogo/casos del enunciado.
- Configurar credenciales y probar workflows importados en n8n; verificar modo callback y autenticación entre servicios.
- Aprovisionamiento seguro del primer administrador implementado mediante `npm run admin:promote` para cuentas ya registradas; mantener pendiente la revisión de parámetros de sesión para el despliegue final.
- Evaluar disponibilidad y retención de datos del proveedor/modelos OpenRouter antes de enviar preguntas reales de estudiantes.

## Estado de entregables

- `database/migrations/001_initial_schema.sql` y `docs/architecture/data-model.md`: **Aplicado en PostgreSQL limpio**; versión de migración y ocho tablas públicas verificadas.
- API Express, frontend, validaciones, manejo de errores, autenticación, contratos de callback, OpenAPI, README y diagramas: **Implementado**; OpenAPI valida 25 paths, las 28 operaciones coinciden con declaraciones de routers y montajes de `app.js`, y resuelve 10 referencias locales; registro HTTP 201 y `/auth/me` probados con PostgreSQL real. La comparación exhaustiva de esquemas de request/response y flujos adicionales de DB sigue pendiente.
- Pruebas: **Probado localmente**, 12/12 pruebas unitarias/HTTP, integración PostgreSQL aislada 1/1 y sintaxis comprobada para 48 archivos JavaScript.
- Docker Compose y Dockerfile: **Arrancados y verificados**; PostgreSQL/Qdrant/n8n/API healthy.
- Workflows `automation/n8n/index-courses.json` y `answer-query.json`: **Validados estáticamente e importados** en n8n 2.46.4, ambos inactivos; credenciales/modelos/ejecución pendientes.
- Qdrant responde pero no tiene colección; embeddings/OpenRouter y RAG de extremo a extremo: **Pendientes de ejecución**; no se presentarán como probados.
- Mínimo de 20 cursos: **Pendiente de curación y de completar atributos respaldados**; la institución y fuente oficial ya están identificadas (actualización abajo).
- Actualización del 2026-11-03: el estudiante definió INTECAP y se localizó el portal oficial de programación/listado; el bloqueo por institución desconocida quedó superado. Se cargó un curso PLC con 100 h y nivel básico explícitos; `database/seeds/001_intecap_programacion_plc.sql` es idempotente y la API lo devuelve. Las fichas 2027 varían: Python no declara horas totales. CTO/CTM/CTMS no documentan equivalencia con el `level` Básico/Intermedio/Avanzado de RutaIA. Hay 1 curso activo; faltan 19 o más para el mínimo.
- Umbral de similitud RAG: **Pendiente de calibración**; no hay valor arbitrario configurado.

## Excepción académica aprobada

El enunciado académico señala Java/Spring Boot. El usuario confirmó que el profesor autorizó Node.js/Express. Esta excepción reemplaza únicamente la tecnología del backend y se registra para trazabilidad; se conservan los demás requisitos del enunciado y la rúbrica. No es un bloqueo ni una propuesta técnica pendiente.
