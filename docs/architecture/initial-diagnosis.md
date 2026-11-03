# RutaIA — diagnóstico y decisiones de implementación

Fecha: 2026-11-02

## Fuentes y autoridad

- El enunciado académico define los requisitos obligatorios y la rúbrica define los puntos de evaluación.
- El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Esta excepción se conserva; el resto del enunciado sigue vigente.
- El Registro de Decisiones define los acuerdos funcionales y visuales. La Especificación Técnica Maestra los convierte en contratos técnicos.
- Ninguna fuente afirma que las funcionalidades o integraciones ya estén implementadas.

## Diagnóstico inicial (2026-11-02)

- Local: rama activa `trabajo`, limpia al inicio de este diagnóstico; `trabajo` y `dev` apuntan a `21a26ad`, y `main` permanece en `b1fdc2a` como línea estable. La suite unitaria/HTTP se repitió en esta sesión: 12 pasan, 0 fallan y 1 prueba optativa de integración se omite. En un intento inicial el sandbox bloqueó sockets loopback; la repetición autorizada localmente completó correctamente.
- GitHub: `TOTO05-a/ruta-ia` accesible; las ramas `main`, `dev` y `trabajo` están publicadas. Desarrollo continúa en `trabajo`.
- Notion: espacio de RutaIA, Registro de Decisiones y Especificación Técnica accesibles.
- Docker: la inspección inicial confirmó PostgreSQL, Qdrant, n8n y backend RutaIA activos. Home Assistant no se modificó.
- Catálogo institucional: no se encontró entre los archivos disponibles. No se fabricarán cursos institucionales para cumplir el mínimo de 20.

## Estado comprobado (2026-11-03)

- Git: `trabajo` está activa y `dev` apunta al mismo commit; `main` conserva la versión estable previa. El trabajo se mantiene local y no se hizo push.
- Pruebas: `npm test` pasó 23/23 con una integración opcional omitida; `npm run test:integration` pasó 1/1 usando `rutaia_test`.
- Compose: backend, PostgreSQL, Qdrant y n8n aparecen saludables. `/health/ready`, `/healthz` y `/readyz` respondieron correctamente; desde el contenedor backend se llegó a n8n y Qdrant. La API pública devolvió 20 cursos activos.
- PostgreSQL conserva las tres migraciones aplicadas. La prueba integrada limpió los registros de `rutaia_test` al terminar.
- n8n contiene los dos workflows como inactivos. El indexador importado tiene 11 nodos, mientras que `automation/n8n/index-courses.json` tiene 14; la instancia debe actualizarse desde el JSON revisado antes de ejecutar la rama de catálogo vacío.
- Qdrant está saludable, pero no contiene colecciones. No hay credenciales de n8n configuradas y las variables `OPENROUTER_EMBEDDING_MODEL`, `OPENROUTER_CHAT_MODEL` y `RAG_MIN_SIMILARITY` están vacías en el backend activo. No se han enviado cursos ni consultas a OpenRouter.
- Ollama local tiene `qwen2.5:3b`. Una inferencia sintética devolvió JSON; n8n llega al servicio del host, pero el modelo responde 501 al endpoint de embeddings. Para una ruta completamente local haría falta un modelo de embeddings y autorización docente para sustituir OpenRouter; no se descargaron modelos.
- La interfaz respondió desde `http://localhost:3001`, pero no se completó una inspección visual en navegador en esta sesión. La herramienta de control se detuvo porque no pudo determinar con confianza la URL actual.
- Esta sesión no dispone de herramientas conectadas de Notion; no se actualizaron las páginas del espacio.

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

- Actualizar los workflows en n8n desde los JSON actuales y mantenerlos inactivos hasta que se configuren y autoricen sus credenciales.
- Seleccionar modelos y umbral compatibles con los datos y el costo permitido. El baseline documentado es `baai/bge-m3` (1024 dimensiones) y `meta-llama/llama-3.3-70b-instruct`, pero no está configurado ni verificado con una credencial.
- Aprobar el destino y costo antes de enviar catálogo o preguntas a cualquier proveedor externo; después indexar y verificar búsqueda, fuentes y callback de extremo a extremo.
- Revisar la interfaz en navegador con sesión real y terminar la evidencia visual.
- Actualizar las tres páginas de Notion cuando la conexión esté disponible.
- Aprovisionamiento del primer administrador disponible mediante `npm run admin:promote` para cuentas ya registradas; revisar los parámetros de sesión antes de cualquier despliegue público.

## Estado de entregables

- Umbral de similitud RAG: **Pendiente de calibración**; no hay valor arbitrario configurado.
- PostgreSQL, migraciones y catálogo: **Verificados localmente**. Las tres migraciones están aplicadas; la API devuelve los 20 cursos de los seeds INTECAP. La integración compara sus campos principales y confirma búsqueda, detalle e idempotencia.
- API, autenticación, perfil, catálogo, consultas, callback, historial, calificaciones y estadísticas: **Probados contra la base dedicada** por `npm run test:integration`; no equivale a una ejecución del workflow n8n.
- Pruebas: `npm test` pasó 23 pruebas y omitió una integración opcional; `npm run test:integration` pasó 1/1.
- Docker Compose: los cuatro servicios RutaIA están saludables; health checks locales y comunicación backend→n8n/Qdrant verificados.
- Workflows: JSON local validado. Los workflows en n8n están inactivos; el indexador importado está desactualizado (11 nodos frente a 14 en el archivo local).
- Qdrant responde y está vacío; OpenRouter y RAG integral **no probados**. Faltan credencial, autorización de costo/privacidad, activar/ejecutar workflows y calibrar umbral.
- Navegador y Notion: pendientes por falta de inspección visual verificable y de conexión Notion en esta sesión.

## Excepción académica aprobada

El enunciado académico señala Java/Spring Boot. El usuario confirmó que el profesor autorizó Node.js/Express. Esta excepción reemplaza únicamente la tecnología del backend y se registra para trazabilidad; se conservan los demás requisitos del enunciado y la rúbrica. No es un bloqueo ni una propuesta técnica pendiente.
