# Workflows de RutaIA en n8n

`index-courses.json`, `answer-query.json` y `sync-course-events.json` son exportaciones versionadas e inactivas. Editar los archivos no modifica automáticamente una instancia n8n ya desplegada.

## Proveedor de IA y secretos

OpenRouter es el proveedor acordado para embeddings y generación. El backend usa `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_CHAT_MODEL`; sus valores predeterminados son `nvidia/nemotron-3.5-embed-1b:free` y `openrouter/free`.

Configura únicamente `OPENROUTER_API_KEY` en el `.env` local del backend. Nunca la copies a n8n, a un nodo, al navegador o a un workflow. n8n llama a proxies internos autenticados de Express:

- `POST /api/v1/internal/ai/embeddings` para embeddings.
- `POST /api/v1/internal/ai/chat` para generar la respuesta grounded.

Ambos endpoints requieren la credencial Header Auth `RutaIA - secreto de sincronización` (`X-N8N-Sync-Secret`). Las credenciales webhook y callback permanecen separadas: webhook con `N8N_WEBHOOK_SECRET` y callback con `N8N_CALLBACK_SECRET`. Usa los valores locales del `.env`; no los publiques.

## Índice manual completo

1. Lee configuración y cursos activos desde Express/PostgreSQL.
2. Construye el texto institucional de cada curso y solicita embeddings por lotes al proxy autenticado de Express.
3. Valida cantidad, dimensiones y valores finitos antes de preparar los puntos de Qdrant.
4. Crea la colección Cosine si no existe, inserta puntos con UUID del curso y elimina vectores de cursos inactivos.

`index-courses.json` es la reconciliación completa, permanece **inactiva** y solo se ejecuta manualmente cuando se necesita reconstruir el índice. La colección anterior `rutaia_courses` tenía 1024 dimensiones. El modelo configurado devolvió 2048 dimensiones en una solicitud sintética; por eso el nuevo destino es `rutaia_courses_openrouter_2048`. El endpoint de configuración y el propio workflow rechazan otro nombre de colección, y la validación del vector exige 2048 dimensiones antes de cualquier escritura. La colección anterior no se reemplaza ni se borra. La reconciliación completa ya no tiene una ejecución periódica cada seis horas.

## Sincronización incremental opcional

`sync-course-events.json` es un workflow independiente e inactivo. Al habilitarlo en n8n, consulta la cola cada minuto; cuando no hay cambios, no solicita embeddings ni lee/reindexa el catálogo. Las inserciones y los cambios relevantes de cursos escriben, mediante el trigger de la migración `005_course_qdrant_sync_outbox.sql`, un evento durable en la misma transacción PostgreSQL. Los cambios repetidos del mismo curso se consolidan en un único evento versionado. Desactivar un curso genera una eliminación del punto; crear, editar o reactivar uno genera un upsert.

Antes de importar/activar el workflow, aplica las migraciones del backend y configura la colección `rutaia_courses_openrouter_2048` (2048 dimensiones), URL de Qdrant y la credencial interna de sincronización. El endpoint de configuración incremental falla cerrado si el destino no es exactamente esa colección, por lo que la sincronización automática nunca puede escribir en `rutaia_courses`. La reconciliación manual completa conserva su uso separado.

El workflow reclama un evento con una concesión de cinco minutos, escribe/elimina el punto y solo entonces confirma el evento. Si falla el embedding o Qdrant, no lo confirma: el evento queda disponible para reintento al expirar la concesión. Si el curso cambia mientras se procesa, la versión anterior no puede confirmar ni borrar la versión nueva. El patrón es al-menos-una-vez, por lo que un fallo después de escribir en Qdrant y antes de confirmar puede repetir el upsert; los IDs de curso hacen la operación idempotente. Las fallas posteriores a una mutación PostgreSQL no revierten ni hacen fallar esa mutación.

La cola crea datos pendientes aunque el workflow permanezca inactivo; al habilitarlo, procesará esos cambios acumulados uno por uno. Mantén el workflow desactivado hasta que la migración y el endpoint autenticado estén disponibles. La importación de estos archivos no activa workflows ni modifica la instancia n8n por sí sola.

## Flujo de consulta RAG

1. Express envía la consulta autenticada al webhook n8n, junto con los filtros opcionales de categoría/nivel y hasta tres pares pregunta/respuesta recientes del mismo estudiante.
2. n8n solicita el embedding de la pregunta al proxy Express y recupera candidatos de Qdrant.
3. Revalida cursos activos en PostgreSQL, aplica el umbral y requiere al menos tres fuentes.
4. Si hay fuentes suficientes, envía a Express las fuentes seleccionadas; el backend llama a OpenRouter y nunca comparte su clave con n8n.
5. n8n valida la respuesta estructurada y persiste estado, fuentes y similitudes mediante el callback autenticado.

El umbral `0.535` fue calibrado con BGE-M3; no se debe asumir válido para el nuevo modelo. `npm run calibrate:rag` obtiene el catálogo y envía 67 textos sintéticos/institucionales en lotes de dos al proxy; si el proveedor rechaza un lote, el proxy intenta sus textos individualmente. El modelo gratuito permite 50 solicitudes por día UTC; una calibración normal requiere al menos 34 llamadas y una reindexación de 38 cursos otras 19. Planifica ambas en días UTC distintos. La primera llamada confirmó embeddings de 2048 dimensiones, pero se agotó el cupo gratuito durante las pruebas y la calibración quedó pendiente; no hay umbral nuevo ni respuesta completa de chat validada. No reindexes ni actives los workflows hasta completar calibración, validar generación y actualizar n8n.

## Actualizar una instancia n8n existente

1. Mantén los workflows exportados inactivos en Git.
2. Importa o actualiza los workflows en la interfaz local de n8n.
3. Verifica que `Generar embeddings vía Express`, `Crear embedding de pregunta` y `Generar respuesta grounded` usen `RutaIA - secreto de sincronización`.
4. Verifica que callbacks usen la credencial `RutaIA - callback Express` y el webhook la credencial `RutaIA - webhook bearer`.
5. No actives el indexador ni ejecutes pruebas de consulta real hasta completar la verificación de dimensión, calibrar el umbral y autorizar las llamadas externas necesarias.

Los cambios en JSON no alteran las credenciales guardadas en n8n. Esta actualización cambia solo los archivos del repositorio; no modifica ni activa la instancia local.

## Validación local

Desde `backend/`:

```powershell
npm run validate:workflows
npm run validate:openapi
npm test
```

Estas comprobaciones son estáticas o usan mocks; no llaman a OpenRouter, no escriben en Qdrant y no prueban una ejecución completa n8n→Qdrant→PostgreSQL.
