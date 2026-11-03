# RutaIA — matriz de aceptación y evidencia

Esta matriz convierte la rúbrica, los casos académicos y los criterios del Registro de Decisiones en verificaciones reproducibles. **Implementado** significa que existe código; solo **Probado** requiere salida reproducible de ejecución.

## Evidencia ejecutada

| Verificación | Comando/procedimiento | Resultado actual |
| --- | --- | --- |
| Suite unitaria, HTTP local y lógica RAG aislada | `cd backend; npm test` | **Probado en esta sesión:** 22 pasan, 0 fallan; 1 integración optativa se omite. Incluye cuatro pruebas de Code nodes con contexto simulado y seis pruebas de mapeo de errores/payload del cliente n8n con `fetch` simulado; no ejecuta el workflow real ni llama servicios externos |
| Integración repetible PostgreSQL/API | `cd backend; npm run test:integration` contra `rutaia_test` | **Probado en esta sesión:** 1/1 pasa; cubre login válido/inválido, `/auth/me`/CSRF/logout, perfil, catálogo oficial de 20, CRUD, historial propio/admin/aislamiento, 401 sin sesión, 404 para historial inexistente, callbacks idempotentes, fuentes activas, ratings y estadísticas. Migraciones aplicadas y fixtures limpiados al terminar |
| Sintaxis JavaScript backend | `node --check` sobre todos los archivos JS versionados/no ignorados de `backend/` | **Probado en esta revisión:** 52 archivos pasan |
| Contrato OpenAPI | `cd backend; npm run validate:openapi` | **Probado en esta actualización:** YAML parseado; las 28 operaciones coinciden con declaraciones de routers y montajes leídos desde `app.js`; 23 referencias locales resueltas. Es una comprobación del proyecto, no un validador oficial completo de OpenAPI |
| Contrato de validación HTTP vs. Zod | Revisar `docs/api/openapi.yaml` contra `backend/src/validators/` y controllers | **Revisado en esta actualización:** paginación/filtros, enum de estado, longitud de búsqueda, límite de duración, requests de perfil, rating, consulta, auth, callback y `intecapCareerType` ahora reflejan las restricciones observadas en código. OpenAPI todavía no define esquemas completos para todos los cuerpos de respuesta; esto no implica validación automatizada de paridad |
| Grafo de workflows | `cd backend; npm run validate:workflows` | **Probado en esta sesión:** 25 nodos, 30 conexiones, 8 Code nodes compilables; ambos workflows exportados inactivos. Cuatro pruebas ejecutan lógica seleccionada con contexto simulado; no acreditan operación en n8n |
| Configuración/arranque Docker Compose | `docker compose --env-file .env config --quiet`; `docker compose up --build -d`; `docker compose ps`; sondas internas de salud | **Probado en esta sesión:** configuración válida, los cuatro servicios RutaIA healthy y HTTP 200 backend→n8n/Qdrant y n8n→backend/Qdrant. No se ejecutaron acciones sobre Home Assistant ni MongoDB |
| PostgreSQL / migración | Compose de app y base de pruebas aislada; migrador, catálogo del sistema, constraints e índices consultados | **Probado:** migraciones 001/002/003 aplicadas en `rutaia`; el runner de integración aplica las pendientes de forma versionada en `rutaia_test`. Esquema: 8 tablas, 8 PK, 7 FK, 17 CHECK, 4 UNIQUE y 21 índices. La integración confirma rechazo SQL de `NaN` y ±`Infinity`; 003 añade y limita `intecap_career_type` a CTO/CTM/CTMS o NULL |
| API conectada a PostgreSQL | Registro HTTP 201, `GET /auth/me` usando cookie y eliminación de cuenta temporal | **Probado:** alta y sesión contra DB real |
| CRUD de cursos en PostgreSQL | Cuenta admin y cursos sintéticos temporales; crear, editar, filtrar categoría/nivel, paginar, desactivar/reactivar y comparar catálogo público/admin; limpieza final | **Probado:** operaciones y visibilidad del catálogo; fixtures eliminados |
| CSRF / rol estudiante | Sin token en mutación admin, GET admin con cuenta estudiante y consulta vacía con CSRF | **Probado con PostgreSQL:** 403 `CSRF_INVALID`, 403 `FORBIDDEN`, 400 `VALIDATION_ERROR`; cuenta temporal eliminada |
| Persistencia / historial / aislamiento | Dos estudiantes temporales; crear consultas, leer estado y listar historial propio con resultado/fuentes; consultar query/historial ajenos | **Probado con PostgreSQL:** propietario recupera historial paginado, estado Respondida, resumen y las tres fuentes persistidas; filtro por estado devuelve el resultado esperado; el otro estudiante recibe 404; fixtures eliminados |
| Autenticación / perfil | Registro, correo duplicado, login correcto/incorrecto, `/auth/me`, `/auth/csrf`, logout y edición controlada del perfil | **Probado con PostgreSQL:** login válido 200 e inválido 401; `/auth/me` 200, CSRF coincide con el token de login, logout 204 y cookie revocada obtiene 401; PATCH con CSRF actualiza nombre/nivel y rechaza `email` con 400; fixtures eliminados |
| Cookie / expiración | Revisar `Set-Cookie`; vencer sesión en DB y consultar `/auth/me`; limpieza final | **Probado:** `HttpOnly`, `SameSite=Lax`, `Max-Age` y 401 `SESSION_EXPIRED` |
| Callbacks y recomendación relacional | Payloads sintéticos `Sin resultados`, `Error` y `Respondida`; fuentes activas, ownership de rating; limpieza de dependencias | **Probado con `npm run test:integration`:** 401 secreto incorrecto; callbacks repetidos de los tres estados son idempotentes; respuesta repetida mantiene una recomendación y tres fuentes; fuente inactiva termina en `Error` (`N8N_INVALID_SOURCES`) sin crear recomendación; rating propio 201, ajeno 404 y duplicado 409. No ejecuta n8n/LLM |
| Estadísticas administrativas | Dataset temporal conocido: una query respondida, tres fuentes y rating 5; resultado API comparado con valores esperados y limpieza completa | **Probado:** totales, promedio y curso recomendado coinciden; DB queda limpia |
| Qdrant, n8n | Healthcheck Docker, endpoint vectorial sintético y endpoints n8n | **Probado:** ambos healthy; búsqueda Cosine ordena correctamente tres vectores sintéticos y colección de prueba eliminada; Qdrant queda sin colecciones; dos workflows importados e inactivos |
| OpenAPI | Contrato YAML parseado, referencias locales resueltas, operaciones documentadas coincidentes con routers/montajes de `app.js` y respuestas descritas | **Probado:** `npm run validate:openapi` pasa con 25 paths, 28 operaciones coincidentes y 23 referencias. Requests principales cotejados con validadores; faltan esquemas completos para todos los cuerpos de respuesta y paridad automatizada |
| OpenRouter / RAG real | Baseline de modelos y políticas ZDR en JSON; credencial, aprobación y ejecución real | **Implementado en fuente, no ejecutado:** `baai/bge-m3` y `meta-llama/llama-3.3-70b-instruct`; n8n conserva copias importadas anteriores al cambio. Credencial, aprobación de privacidad, verificación del proveedor elegible y RAG integral pendientes |
| Navegador/visual | Inspección previa de login/registro a 302 px; navegador local actual | **Probado parcialmente:** login/registro quedaron sin desbordamiento horizontal en la inspección anterior. No se pudo repetir en esta sesión porque Work settings deshabilita el uso del navegador local; escritorio, vistas autenticadas y flujos completos siguen pendientes |
| Categorías del catálogo | Opciones de categoría reunidas desde todas las páginas del catálogo activo; se invalidan tras CRUD/estado admin | **Implementado y sintaxis validada:** `node --check frontend/assets/js/app.js`; revisión interactiva en navegador pendiente |
| Cierre de sesión en frontend | Cambia a la vista pública solo después de confirmar logout API; ante error retiene el estado autenticado y muestra el fallo | **Implementado y sintaxis validada:** `node --check frontend/assets/js/app.js`; interacción de navegador pendiente |
| Accesibilidad teclado | Handler Enter/Espacio y estilos `:focus-visible` de tarjetas de catálogo/historial | **Revisado estáticamente**; verificación visual/interactiva en navegador pendiente |

## API, datos y seguridad

| ID | Criterio | Verificación de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| API-01 | Registro y autenticación | Registro completo, correo duplicado, login válido/inválido, cierre, cookie HttpOnly, expiración | **Probado con PostgreSQL:** registro (201), duplicado (409), login correcto/incorrecto (200/401), logout (204), revocación/expiración (401); cookie con HttpOnly/SameSite/Max-Age |
| API-02 | CSRF y autorización | Mutación sin token rechazada; estudiante no accede al perfil/historial ni calificación ajenos; admin sí puede gestionar | **Probado con PostgreSQL:** mutación sin token (403 `CSRF_INVALID`), estudiante en recurso admin (403 `FORBIDDEN`), consulta/historial ajenos (404), rating ajeno (404 `RECOMMENDATION_NOT_FOUND`) y CRUD admin; fixtures eliminados |
| API-03 | Perfil | Actualizar solo campos permitidos; rechazar campos adicionales/valores fuera de enum | **Probado con PostgreSQL:** interés actualizado; campo extra rechazado con 400; fixtures eliminados |
| DB-01 | Migración limpia/versionada | Aplicar migraciones pendientes y confirmar FKs, índices, checks y tabla de versiones | **Probado:** `001`–`003` aplicadas en `rutaia`; runner aplica pendientes de manera versionada en `rutaia_test`. PostgreSQL confirma ocho tablas, 8 PK, 7 FK, 17 CHECK, 4 UNIQUE y 21 índices; la prueba SQL rechaza `NaN`, `Infinity` y `-Infinity`. La migración `003` agrega el tipo oficial nullable con constraint CTO/CTM/CTMS |
| DB-02 | Cursos institucionales | Contar al menos 20 cursos auténticos con todos los campos del modelo; revisar detalle, filtros, estado activo y catálogo público | **Catálogo verificado; aceptación restante parcial:** 20 ofertas INTECAP oficiales cuentan con duración publicada, objetivos resumidos y referencias directas en los seeds; la integración comprueba nombres, horas, nivel pedagógico, tipo oficial separado, idempotencia y lectura individual vía API para los 20. Pruebas CRUD/filtros/estado activo cubren el comportamiento de catálogo con fixtures separados; RAG aún no está habilitado. `level` es taxonomía de RutaIA basada en objetivos/requisitos y no clasificación ocupacional INTECAP; `intecap_career_type` queda NULL cuando no se publica CTO/CTM/CTMS. |
| API-04 | CRUD y catálogo | Crear/consultar/editar/activar/desactivar; filtros y paginación; no listar inactivos públicamente | **Probado con PostgreSQL:** crear, editar, filtrar, paginar, desactivar/reactivar; público oculta inactivos y admin los conserva. Fixtures eliminados |
| API-05 | IDs inexistentes | Estudiantes, cursos, consultas e historial de estudiante inexistentes devuelven 404 normalizado; rutas protegidas sin sesión devuelven 401 | **Probado con PostgreSQL:** estudiante/curso/consulta e historial de estudiante inexistentes devuelven 404; historial sin sesión devuelve 401; UUID inválido devuelve 400 `VALIDATION_ERROR`; admin puede leer historial de estudiante existente |
| API-06 | Calificación | Enteros 1–5; comentario opcional; una calificación por recomendación | **Probado con PostgreSQL:** rating 5 devuelve 201; el duplicado devuelve 409; datos temporales eliminados |
| API-07 | Estadísticas | Comparar total, respondidas, sin resultados, promedio y curso más recomendado contra SQL conocido | **Probado con PostgreSQL:** dataset sintético conocido coincide en total, respondidas, sin resultados, promedio y recomendaciones por curso; datos eliminados |
| API-08 | Errores | JSON inválido, validación, proveedor caído, timeout y errores no exponen stack ni secretos | JSON malformado, 404 genérico, IDs inválidos y validaciones (400) probados. Cliente n8n prueba config faltante, timeout simulado, red caída y HTTP 401 simulado con códigos seguros; fallos reales DB/proveedor/timeout siguen pendientes |

## Qdrant, embeddings y RAG

| ID | Caso | Criterio de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| RAG-01 | Indexación | Modelo igual al usado en consulta; dimensión y números finitos; UUID estable; upsert repetido no duplica | Baseline `baai/bge-m3` (1024 dimensiones) y guardas estáticas; Qdrant probó vector/score/payload sintético; dimensiones del endpoint real, workflow y upsert de cursos pendientes |
| RAG-02 | Sincronía catálogo | Crear/editar/reactivar se refleja en índice; reconciliación retira puntos obsoletos y consulta filtra relacionalmente | Indexación periódica cada seis horas; JSON estático validado; ejecución pendiente |
| RAG-03 | Desarrollo web | Recomendar solo cursos pertinentes, activos y explicados con su fuente | Catálogo disponible; indexación, configuración del proveedor y ejecución integral pendientes |
| RAG-04 | Java/Spring Boot como aprendizaje | Puede recomendar cursos del catálogo relacionados; no cambia el backend Express | Catálogo disponible; caso etiquetado, indexación y ejecución integral pendientes |
| RAG-05 | Datos/dashboard | Recomendar cursos pertinentes del catálogo | Catálogo disponible; caso etiquetado, indexación y ejecución integral pendientes |
| RAG-06 | Automatización, IA, seguridad web y contenedores | Recuperar únicamente fuentes relacionadas y explicar límites del catálogo | Catálogo disponible; casos etiquetados, indexación y ejecución integral pendientes |
| RAG-07 | Cocina italiana / fuera de dominio | Terminar en `Sin resultados` si el catálogo no ofrece fuentes pertinentes | Lógica implementada; umbral/calibración y ejecución pendientes |
| RAG-08 | Umbral | Elegir valor usando preguntas relevantes e irrelevantes etiquetadas; medir falsos positivos/negativos con la escala del modelo | **Pendiente**; no se configuró número arbitrario |
| RAG-09 | Grounding | Respuesta usa solo cursos y propiedades de las fuentes recuperadas; reconocer insuficiencia | Prompt restrictivo implementado en workflow; validación de salida y evaluación empírica pendientes |

## Estados y n8n

| ID | Caso | Criterio de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| N8N-01 | `Respondida` | Consultar → embedding → ventana de candidatos → filtrar activos/umbral → seleccionar hasta cinco → respuesta → persistir 3–5 sources y scores | Workflow importado e inactivo; contrato callback/persistencia probado con payload sintético; ejecución del workflow y modelo pendiente |
| N8N-02 | `Sin resultados` | Menos de 3 fuentes autorizadas bajo umbral; persiste estado sin recomendación | Callback y persistencia probados con query sintética; workflow importado e inactivo; selección RAG pendiente |
| N8N-03 | `Error` | Fallo de llamada/validación de proveedor genera callback con código seguro y sin detalles sensibles | **Contrato API/DB probado** con callback Error sintético, lectura final del código e idempotencia. La rama que genera el callback dentro de n8n sigue pendiente de ejecución |
| N8N-04 | Callback repetido y fuente activa | No crea recomendaciones duplicadas; rechaza referencias a cursos inactivos y mantiene resultado terminal | **Probado con PostgreSQL:** repetir `Respondida` devuelve 200 y conserva una recomendación/tres fuentes; repetir `Sin resultados`, `Error` y callback inválido por curso inactivo también es idempotente |
| N8N-05 | Credenciales | Header Auth configurado en n8n; OpenRouter key cifrada por n8n; secretos no están en workflow/repo | Fuente JSON no contiene claves y exige ZDR/`data_collection=deny`; copias n8n requieren actualización; alta/asignación de credenciales pendiente |

## Pruebas académicas de entrada

- Pregunta vacía: rechazada antes de crear consulta (validador unitario probado).
- Estudiante inexistente: `GET /api/v1/students/{id}` y su historial devuelven 404, incluso si solicita admin. Historial sin sesión devuelve 401; historial de un estudiante existente puede consultarse con rol admin. Probado en integración PostgreSQL.
- Usuario intenta leer otra consulta y otro historial: ambos devuelven 404; probado con dos cuentas temporales.
- Consulta válida: la ruta real persistió `Pendiente` y pasó a `Error` seguro por proveedor no configurado. Callbacks sintéticos persistieron `Respondida` con 3 fuentes y `Sin resultados`; ejecución n8n/OpenRouter pendiente.
- Desactivar curso después de indexarlo: su coincidencia vectorial nunca debe pasar el filtro de cursos activos.

## Puertas para marcar RutaIA como terminada

1. Catálogo INTECAP de 20 cursos ya cargado y verificado por seeds/API; preservar fuentes y campos al resembrar en instalaciones limpias.
2. Compose arrancado sin alterar contenedores ajenos; migraciones versionadas aplicadas.
3. Con acceso de propietario, importar/sincronizar workflows y configurar credenciales aprobadas; confirmar proveedor/modelos y política de privacidad.
4. Indexar los 20 cursos en Qdrant; comprobar dimensión, cantidad, payload, upsert/reconciliación y filtro de activos.
5. Calibrar umbral con set etiquetado; probar Respondida/Sin resultados/Error y comparar fuentes/scores con PostgreSQL/Qdrant.
6. Frontend revisado en navegador y probado contra backend integrado.
7. Rúbrica revisada criterio por criterio; evidencia de demostración, README y presentación preparados.
