# RutaIA — matriz de aceptación y evidencia

Esta matriz convierte la rúbrica, los casos académicos y los criterios del Registro de Decisiones en verificaciones reproducibles. **Implementado** significa que existe código; solo **Probado** requiere salida reproducible de ejecución.

## Evidencia ejecutada

| Verificación | Comando/procedimiento | Resultado actual |
| --- | --- | --- |
| Suite unitaria y HTTP local | `cd backend; npm test` | **Probado:** 12/12 pasan; la prueba de DB optativa se omite sin activar integración |
| Integración repetible PostgreSQL/API | `cd backend; npm run test:integration` contra `rutaia_test` | **Probado:** 1/1 pasa; repetición con migración existente también pasa; cero fixtures al terminar |
| Sintaxis JavaScript backend | `node --check` sobre todos los archivos `backend/**/*.js` | **Probado:** 48 archivos pasan |
| Grafo de workflows | Parse JSON, unicidad de ID/nombre, aristas y compilación de `jsCode` | **Probado estáticamente e importado:** 11 nodos de indexación y 14 de consulta; ambos workflows inactivos |
| Configuración Docker Compose | `docker compose --env-file .env config --quiet` | **Probado**; stack local levantado |
| PostgreSQL / migración | Compose de app y base de pruebas aislada; migrador y versión consultados | **Probado:** ocho tablas públicas en `rutaia`, migración también idempotente en `rutaia_test`; ambas bases sin fixtures funcionales |
| API conectada a PostgreSQL | Registro HTTP 201, `GET /auth/me` usando cookie y eliminación de cuenta temporal | **Probado:** alta y sesión contra DB real |
| CRUD de cursos en PostgreSQL | Cuenta admin y cursos sintéticos temporales; crear, editar, filtrar categoría/nivel, paginar, desactivar/reactivar y comparar catálogo público/admin; limpieza final | **Probado:** operaciones y visibilidad del catálogo; fixtures eliminados |
| CSRF / rol estudiante | Sin token en mutación admin, GET admin con cuenta estudiante y consulta vacía con CSRF | **Probado:** 403 `CSRF_INVALID`, 403 `FORBIDDEN`, 400 `VALIDATION_ERROR`; cuenta temporal eliminada |
| Persistencia / aislamiento de consultas | Dos estudiantes temporales; crear una consulta sin proveedor, leerla como propietario y consultar query/historial ajenos | **Probado:** queda en `Error` seguro, propietario la lee y el otro recibe 404; registros de prueba eliminados |
| Autenticación / perfil | Registro, correo duplicado, login correcto/incorrecto, PATCH permitido/extra, logout y reutilización de sesión | **Probado con PostgreSQL:** 201/409/200/401/200/400/204/401; cuenta temporal eliminada |
| Cookie / expiración | Revisar `Set-Cookie`; vencer sesión en DB y consultar `/auth/me`; limpieza final | **Probado:** `HttpOnly`, `SameSite=Lax`, `Max-Age` y 401 `SESSION_EXPIRED` |
| Callbacks y recomendación relacional | Payload sintético `Sin resultados` repetido; payload `Respondida` con tres cursos activos; rating y duplicado; limpieza de dependencias | **Probado en API/DB:** 401 secreto incorrecto, 202 inicial, 200 callback repetido, tres fuentes persistidas, rating 201/duplicado 409. No ejecuta n8n/LLM |
| Estadísticas administrativas | Dataset temporal conocido: una query respondida, tres fuentes y rating 5; resultado API comparado con valores esperados y limpieza completa | **Probado:** totales, promedio y curso recomendado coinciden; DB queda limpia |
| Qdrant, n8n | Healthcheck Docker y endpoints locales | **Probado:** ambos healthy; Qdrant sin colección; dos workflows importados e inactivos |
| OpenRouter / RAG real | Falta modelo y credencial de proveedor; falta catálogo de cursos | **Pendiente** |
| Navegador/visual | Revisión automatizada en navegador no completada | **Pendiente** |
| Accesibilidad teclado | Handler Enter/Espacio y estilos `:focus-visible` de tarjetas de catálogo/historial | **Revisado estáticamente**; verificación visual/interactiva en navegador pendiente |

## API, datos y seguridad

| ID | Criterio | Verificación de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| API-01 | Registro y autenticación | Registro completo, correo duplicado, login válido/inválido, cierre, cookie HttpOnly, expiración | **Probado con PostgreSQL:** registro (201), duplicado (409), login correcto/incorrecto (200/401), logout (204), revocación/expiración (401); cookie con HttpOnly/SameSite/Max-Age |
| API-02 | CSRF y autorización | Mutación sin token rechazada; estudiante no accede al perfil/historial ajeno; admin sí puede gestionar | **Probado parcialmente con DB:** mutación sin token (403), estudiante en ruta admin (403), consulta e historial ajenos (404); demás recursos pendientes |
| API-03 | Perfil | Actualizar solo campos permitidos; rechazar campos adicionales/valores fuera de enum | **Probado con PostgreSQL:** interés actualizado; campo extra rechazado con 400; fixtures eliminados |
| DB-01 | Migración limpia | Aplicar migration a PostgreSQL vacío y confirmar FKs, índices, checks y tabla de versiones | **Probado:** aplicada al iniciar Compose limpio; ocho tablas públicas y versión consultadas; inspección completa de constraints pendiente |
| DB-02 | Cursos institucionales | Contar al menos 20 cursos aprobados; revisar detalle, filtros, estado activo y catálogo público | **Bloqueado:** falta fuente institucional autorizada |
| API-04 | CRUD y catálogo | Crear/consultar/editar/activar/desactivar; filtros y paginación; no listar inactivos públicamente | **Probado con PostgreSQL:** crear, editar, filtrar, paginar, desactivar/reactivar; público oculta inactivos y admin los conserva. Fixtures eliminados |
| API-05 | IDs inexistentes | Estudiantes, cursos y consultas inexistentes devuelven 404 normalizado | Ruta 404 genérica probada; casos con DB pendientes |
| API-06 | Calificación | Enteros 1–5; comentario opcional; una calificación por recomendación | **Probado con PostgreSQL:** rating 5 devuelve 201; el duplicado devuelve 409; datos temporales eliminados |
| API-07 | Estadísticas | Comparar total, respondidas, sin resultados, promedio y curso más recomendado contra SQL conocido | **Probado con PostgreSQL:** dataset sintético conocido coincide en total, respondidas, sin resultados, promedio y recomendaciones por curso; datos eliminados |
| API-08 | Errores | JSON inválido, validación, proveedor caído, timeout y errores no exponen stack ni secretos | JSON malformado/404 y pregunta vacía (400) probados; fallos DB/proveedor/timeout pendientes |

## Qdrant, embeddings y RAG

| ID | Caso | Criterio de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| RAG-01 | Indexación | Modelo igual al usado en consulta; dimensión y números finitos; UUID estable; upsert repetido no duplica | Workflow JSON y reglas estáticas; ejecución Qdrant pendiente |
| RAG-02 | Sincronía catálogo | Crear/editar/reactivar se refleja en índice; reconciliación retira puntos obsoletos y consulta filtra relacionalmente | Indexación periódica cada seis horas; JSON estático validado; ejecución pendiente |
| RAG-03 | Desarrollo web | Recomendar solo cursos pertinentes, activos y explicados con su fuente | Pendiente de catálogo y ejecución integral |
| RAG-04 | Java/Spring Boot como aprendizaje | Puede recomendar cursos del catálogo relacionados; no cambia el backend Express | Pendiente de catálogo/casos etiquetados |
| RAG-05 | Datos/dashboard | Recomendar cursos pertinentes del catálogo | Pendiente de catálogo/casos etiquetados |
| RAG-06 | Automatización, IA, seguridad web y contenedores | Recuperar únicamente fuentes relacionadas y explicar límites del catálogo | Pendiente de catálogo/casos etiquetados |
| RAG-07 | Cocina italiana / fuera de dominio | Terminar en `Sin resultados` si el catálogo no ofrece fuentes pertinentes | Lógica implementada; umbral/calibración y ejecución pendientes |
| RAG-08 | Umbral | Elegir valor usando preguntas relevantes e irrelevantes etiquetadas; medir falsos positivos/negativos con la escala del modelo | **Pendiente**; no se configuró número arbitrario |
| RAG-09 | Grounding | Respuesta usa solo cursos y propiedades de las fuentes recuperadas; reconocer insuficiencia | Prompt restrictivo implementado en workflow; validación de salida y evaluación empírica pendientes |

## Estados y n8n

| ID | Caso | Criterio de aceptación | Estado/evidencia |
| --- | --- | --- | --- |
| N8N-01 | `Respondida` | Consultar → embedding → ventana de candidatos → filtrar activos/umbral → seleccionar hasta cinco → respuesta → persistir 3–5 sources y scores | Workflow importado e inactivo; contrato callback/persistencia probado con payload sintético; ejecución del workflow y modelo pendiente |
| N8N-02 | `Sin resultados` | Menos de 3 fuentes autorizadas bajo umbral; persiste estado sin recomendación | Callback y persistencia probados con query sintética; workflow importado e inactivo; selección RAG pendiente |
| N8N-03 | `Error` | Fallo de llamada/validación de proveedor genera callback con código seguro y sin detalles sensibles | Rama importada e inactiva; ejecución pendiente |
| N8N-04 | Callback repetido | No crea recomendaciones duplicadas; mantiene resultado terminal | **Probado con PostgreSQL:** callback repetido devuelve 200 sin cambiar estado terminal |
| N8N-05 | Credenciales | Header Auth configurado en n8n; OpenRouter key cifrada por n8n; secretos no están en workflow/repo | JSON no contiene claves; alta/asignación de credenciales pendiente |

## Pruebas académicas de entrada

- Pregunta vacía: rechazada antes de crear consulta (validador unitario probado).
- Estudiante inexistente o sin sesión: se rechaza con 401/404 según el recurso; prueba con PostgreSQL pendiente.
- Usuario intenta leer otra consulta y otro historial: ambos devuelven 404; probado con dos cuentas temporales.
- Consulta válida: la ruta real persistió `Pendiente` y pasó a `Error` seguro por proveedor no configurado. Callbacks sintéticos persistieron `Respondida` con 3 fuentes y `Sin resultados`; ejecución n8n/OpenRouter pendiente.
- Desactivar curso después de indexarlo: su coincidencia vectorial nunca debe pasar el filtro de cursos activos.

## Puertas para marcar RutaIA como terminada

1. Fuente institucional autorizada cargada y mínimo de 20 cursos confirmados.
2. Compose arrancado sin alterar contenedores ajenos; migración limpia aplicada.
3. Workflows importados con credenciales reales en n8n y modelos revisados por disponibilidad/retención.
4. Umbral calibrado con set etiquetado y casos de dominio/fuera de dominio.
5. Pruebas de DB/API y los tres estados ejecutadas; fuentes/scores comparados con PostgreSQL/Qdrant.
6. Frontend revisado en navegador y probado contra backend integrado.
7. Rúbrica revisada criterio por criterio; evidencia de demostración, README y presentación preparados.
