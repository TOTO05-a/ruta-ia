# Workflows de RutaIA en n8n

`index-courses.json`, `answer-query.json` y `sync-course-events.json` son exportaciones versionadas e inactivas. Editar los archivos no modifica automáticamente una instancia n8n ya desplegada.

## Proveedor de IA y secretos

Gemini genera embeddings (`GEMINI_EMBEDDING_MODEL=gemini-embedding-2`, 1536 dimensiones) y OpenRouter genera las respuestas grounded mediante el modelo configurado en `OPENROUTER_CHAT_MODEL`.

Configura `GEMINI_API_KEY`, `OPENROUTER_API_KEY` y `OPENROUTER_CHAT_MODEL` en el `.env` local del backend. Nunca copies las claves a n8n, a un nodo, al navegador o a un workflow. n8n llama a proxies internos autenticados de Express:

- `POST /api/v1/internal/ai/embeddings` para embeddings.
- `POST /api/v1/internal/ai/chat` para generar la respuesta grounded.

Ambos endpoints requieren la credencial Header Auth `RutaIA - secreto de sincronización` (`X-N8N-Sync-Secret`). Las credenciales webhook y callback permanecen separadas: webhook con `N8N_WEBHOOK_SECRET` y callback con `N8N_CALLBACK_SECRET`. Usa los valores locales del `.env`; no los publiques.

## Índice manual completo

1. Lee configuración y cursos activos desde Express/PostgreSQL.
2. Construye el texto institucional de cada curso y solicita embeddings por lotes al proxy autenticado de Express.
3. Valida cantidad, dimensiones y valores finitos antes de preparar los puntos de Qdrant.
4. Crea la colección Cosine si no existe, inserta puntos con UUID del curso y elimina vectores de cursos inactivos.

`index-courses.json` es la reconciliación completa, permanece **inactiva** y solo se ejecuta manualmente cuando se necesita reconstruir el índice. La colección anterior `rutaia_courses` tiene 1024 dimensiones; el destino nuevo configurado es `rutaia_courses_gemini_1536`. El endpoint y el workflow rechazan otro nombre de colección, y la validación del vector exige exactamente 1536 dimensiones antes de cualquier escritura. La colección anterior no se reemplaza ni se borra. La reconciliación completa no tiene una ejecución periódica.

## Sincronización incremental opcional

`sync-course-events.json` es un workflow independiente e inactivo. Al habilitarlo en n8n, consulta la cola cada minuto; cuando no hay cambios, no solicita embeddings ni lee/reindexa el catálogo. Las inserciones y los cambios relevantes de cursos escriben, mediante el trigger de la migración `005_course_qdrant_sync_outbox.sql`, un evento durable en la misma transacción PostgreSQL. Los cambios repetidos del mismo curso se consolidan en un único evento versionado. Desactivar un curso genera una eliminación del punto; crear, editar o reactivar uno genera un upsert.

Para mantener la reconciliación fácil de explicar, los workflows versionados tienen tres responsabilidades separadas. Los datos del callback de error se construyen directamente en el HTTP Request que lo envía, y la solicitud de limpieza de Qdrant obtiene los IDs activos de los nodos anteriores sin un Code node intermedio. Se conservan las validaciones de colección y vectores, la selección de cursos activos, la comprobación de respuestas de Qdrant y la confirmación condicional del outbox. En conjunto, las tres exportaciones usan 38 nodos (11 Code); los JSON permanecen inactivos.

Antes de importar/activar el workflow, aplica las migraciones del backend y configura la colección `rutaia_courses_gemini_1536` (1536 dimensiones), URL de Qdrant y la credencial interna de sincronización. El endpoint de configuración incremental falla cerrado si el destino no es exactamente esa colección, por lo que la sincronización automática nunca puede escribir en `rutaia_courses`. La reconciliación manual completa conserva su uso separado.

El workflow reclama un evento con una concesión de cinco minutos, escribe/elimina el punto y solo entonces confirma el evento. Si falla el embedding o Qdrant, no lo confirma: el evento queda disponible para reintento al expirar la concesión. Si el curso cambia mientras se procesa, la versión anterior no puede confirmar ni borrar la versión nueva. El patrón es al-menos-una-vez, por lo que un fallo después de escribir en Qdrant y antes de confirmar puede repetir el upsert; los IDs de curso hacen la operación idempotente. Las fallas posteriores a una mutación PostgreSQL no revierten ni hacen fallar esa mutación.

La cola crea datos pendientes aunque el workflow permanezca inactivo; al habilitarlo, procesará esos cambios acumulados uno por uno. Mantén el workflow desactivado hasta que la migración y el endpoint autenticado estén disponibles. La importación de estos archivos no activa workflows ni modifica la instancia n8n por sí sola.

## Flujo de consulta RAG

1. Express envía la consulta autenticada al webhook n8n, junto con el umbral opcional, los filtros de categoría/nivel y hasta tres pares pregunta/respuesta recientes del mismo estudiante.
2. n8n solicita el embedding de la pregunta al proxy Express y recupera como máximo cinco candidatos de Qdrant con sus scores.
3. Revalida cursos activos en PostgreSQL y conserva solo las fuentes cuyo score alcanza el umbral. Si no queda ninguna, responde `Sin resultados`; con una o más, prepara el contexto RAG.
4. Si hay fuentes suficientes, envía a Express las fuentes seleccionadas; el backend llama a OpenRouter y nunca comparte su clave con n8n.
5. n8n valida la respuesta estructurada y persiste estado, fuentes y similitudes mediante el callback autenticado.

El campo `umbral` acepta valores entre `-1` y `1`. Por ejemplo, `0.50` y `0.85` pueden producir distintas cantidades de fuentes y contextos; Qdrant devuelve primero hasta cinco candidatos y el workflow compara sus scores antes de llamar al modelo.

La calibración real con Gemini se ejecutó sobre los 37 cursos activos y 22 consultas: la ventana fue `0.6347–0.6484` y `RAG_MIN_SIMILARITY=0.642` permanece provisional. En siete consultas académicas complementarias, cuatro alcanzaron tres candidatos sobre el umbral y tres no; esa medición no demuestra pertinencia. La colección `rutaia_courses_gemini_1536` contiene los 37 UUID activos (1536 dimensiones); la colección antigua de 1024 dimensiones permanece intacta. Dos acciones `delete` siguen pendientes en el outbox. Se cambió el modelo chat retirado a `gemini-3.5-flash-lite`. El responder Gemini se publicó y una E2E real de la app verificó callback e historial: terminó `Respondida` con tres fuentes. La cuenta y la consulta sintéticas se eliminaron.

## Actualizar una instancia n8n existente

1. Mantén los workflows exportados inactivos en Git.
2. Importa o actualiza los workflows en la interfaz local de n8n.
3. Verifica que `Generar embeddings vía Express`, `Crear embedding de pregunta` y `Generar respuesta grounded` usen `RutaIA - secreto de sincronización`.
4. Verifica que callbacks usen la credencial `RutaIA - callback Express` y el webhook la credencial `RutaIA - webhook bearer`.
5. El responder RAG está publicado y pasó una E2E previa. Antes de generar respuestas con la implementación actual, configura OpenRouter en el `.env` y reconstruye el backend. Mantén el indexador despublicado hasta validar el workflow incremental y revisar los dos eventos pendientes.

Estado de la instancia local (6 nov 2026): el responder RAG está publicado y el indexador está despublicado. Las credenciales de webhook, proxy interno y callbacks se verificaron en la interfaz; no se guardó una clave de proveedor en n8n. El estado registrado es anterior al cambio de generación a OpenRouter. Los cambios en JSON no alteran por sí solos las credenciales guardadas en n8n. La configuración actual exige colección y vectores Gemini de 1536 dimensiones; no se debe ejecutar el flujo contra la colección anterior de 1024 dimensiones.

## Validación local

Desde `backend/`:

```powershell
npm run validate:workflows
npm run validate:openapi
npm test
```

Estas comprobaciones son estáticas o usan mocks; no llaman a Gemini, no escriben en Qdrant y no prueban una ejecución completa n8n→Qdrant→PostgreSQL.
