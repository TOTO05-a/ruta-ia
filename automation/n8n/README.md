# Workflows de RutaIA en n8n

Los archivos `index-courses.json` y `answer-query.json` son workflows exportables y permanecen inactivos en Git. Ollama produce embeddings en ambas configuraciones y genera texto cuando `AI_PROVIDER=ollama`. Si se elige `AI_PROVIDER=openrouter`, el nodo de generación llama a un proxy interno de Express; solo el backend ve la API key y envía a OpenRouter la pregunta y el contexto de cursos seleccionados.

## Requisitos y conexión Ollama

1. Instala/inicia Ollama en Windows o Linux y descarga los modelos configurados en `.env`:

   ```powershell
   ollama pull bge-m3
   ollama pull qwen2.5:3b
   ollama list
   ```

2. Ollama debe escuchar en una interfaz alcanzable desde Docker, porque dentro de los contenedores `localhost` es el propio contenedor. La configuración por defecto es `OLLAMA_BASE_URL=http://host.docker.internal:11434`. `docker-compose.yml` asigna `host.docker.internal:host-gateway` tanto a backend como a n8n; Docker resuelve `host-gateway` hacia el host en Linux. En Linux configura el servicio Ollama con `OLLAMA_HOST=0.0.0.0:11434`; en Windows usa Ollama Desktop y las reglas locales necesarias. Comprueba la API local con `curl http://127.0.0.1:11434/api/tags` (o `Invoke-RestMethod` en PowerShell) y desde el contenedor n8n con una petición a `http://host.docker.internal:11434/api/tags`. No publiques el puerto en Internet.
3. Configura `OLLAMA_EMBEDDING_MODEL=bge-m3`. Usa el mismo modelo para indexar y consultar. Qdrant creará la colección con la dimensión devuelta por Ollama; cambiar modelo puede requerir una colección nueva y reindexación. Para generación local, usa `AI_PROVIDER=ollama` y `OLLAMA_CHAT_MODEL=qwen2.5:3b`. Para generación remota gratuita, usa `AI_PROVIDER=openrouter`, guarda la clave en `OPENROUTER_API_KEY` del `.env` y mantén `OPENROUTER_CHAT_MODEL=openrouter/free` (o un modelo cuyo ID termine en `:free`). El backend rechaza IDs de modelos de pago.
4. Calibra `RAG_MIN_SIMILARITY` con preguntas pertinentes y fuera de dominio antes de activar la consulta.

Ollama no cobra inferencia; la descarga ocupa espacio local y la generación utiliza CPU/GPU y memoria de la PC. El backend permite hasta 120 segundos por defecto (ajustable en `AI_CHAT_TIMEOUT_MS`), porque los equipos modestos pueden generar con lentitud. La API de OpenRouter puede variar disponibilidad, políticas y cuotas; usa solo datos sintéticos para pruebas remotas. La clave se entrega únicamente al backend y nunca forma parte del payload del workflow ni de las ejecuciones n8n.

## Credenciales n8n

Los nodos internos conservan estas credenciales Header Auth; crea cada una en n8n y usa los secretos locales correspondientes:

| Nombre exacto | Header | Valor |
| --- | --- | --- |
| RutaIA - webhook bearer | `Authorization` | `Bearer <N8N_WEBHOOK_SECRET>` |
| RutaIA - secreto de sincronización | `X-N8N-Sync-Secret` | `N8N_COURSE_SYNC_SECRET` |
| RutaIA - callback Express | `X-N8N-Callback-Secret` | `N8N_CALLBACK_SECRET` |

No hay credencial para Ollama: la API local no exige clave por defecto. El nodo `Generar respuesta grounded` también usa la credencial `RutaIA - secreto de sincronización` para autorizar el endpoint interno de Express. No crees una credencial OpenRouter en n8n. Las credenciales internas se guardan cifradas por n8n y no se incluyen en el repositorio.

### Asignación en los nodos

Abre cada nodo, selecciona la credencial existente en **Credential to connect with** y guarda el workflow. Usa la credencial de sincronización en `Leer configuración de indexación`, `Leer catálogo PostgreSQL`, `Leer catálogo activo PostgreSQL` y `Generar respuesta grounded`; usa callback en `Guardar recomendación en Express`, `Guardar estado sin resultados` y `Guardar estado de error`; el webhook `Webhook autenticado de consulta` requiere la credencial bearer. En `Crear embedding de pregunta`, configura **Authentication: None**: llama directamente a Ollama.

### Actualizar el workflow de consulta que ya existe

Editar los JSON del repositorio no actualiza el workflow guardado en n8n. En una instalación que ya está funcionando, abre `RutaIA - Responder consultas RAG` y, en el nodo `Generar respuesta grounded`, cambia:

- URL a `http://backend:3000/api/v1/internal/ai/chat`.
- Authentication a **Generic Credential Type → Header Auth** y selecciona `RutaIA - secreto de sincronización`.

Deja el método POST, el body JSON (incluidos `messages`, `format` y `options`) y la salida JSON. Guarda el workflow. La API ignora el campo `model` del body y elige el modelo configurado en el backend. No pegues la API key OpenRouter en n8n. Con `AI_PROVIDER=ollama`, este nodo continúa usando el modelo local mediante el proxy. El workflow debe pasar primero una consulta sintética de extremo a extremo antes de cambiar `.env` a OpenRouter.

## Flujo de indexación

- Manual y cada seis horas: lee configuración y cursos activos por endpoints internos autenticados de Express/PostgreSQL.
- Construye los textos de curso y solicita lotes de embeddings a Ollama.
- Valida recuento, dimensión y valores finitos; crea colección Cosine cuando no existe y hace upsert con UUID del curso.
- Quita vectores obsoletos al reconciliar los cursos activos. Si el catálogo queda vacío, limpia Qdrant sin invocar Ollama.

## Flujo de consulta RAG

- Express envía consulta autenticada al webhook de n8n. El workflow consulta el catálogo, crea embedding local con Ollama y busca hasta 50 candidatos en Qdrant.
- Vuelve a comprobar que las fuentes existan y estén activas en PostgreSQL; aplica el umbral y limita las fuentes a cinco.
- Con tres o más fuentes llama al endpoint interno autenticado de Express. El backend elige Ollama u OpenRouter según `.env`, normaliza la respuesta y mantiene la API key fuera de n8n. Con menos de tres, devuelve `Sin resultados`. La generación limita la respuesta a 192 tokens y valida JSON con `answer`, `summary` y `explanation`; luego persiste resultado, fuentes y scores por callback autenticado.
- Las ramas de error hacen callback con un código genérico y no muestran detalles internos al estudiante.

## Importar y comprobar

1. En `http://localhost:5678`, crea la cuenta propietaria local e importa los dos JSON de esta carpeta.
2. Crea la credencial webhook si aún no existe y asigna las tres credenciales internas según la tabla de nodos. Al importar en una instalación que ya tenía workflows, revisa manualmente las credenciales de cada nodo antes de guardar; las credenciales guardadas pueden no coincidir con el archivo importado.
3. Mantén los workflows inactivos hasta comprobar `/api/tags` desde el contenedor y verificar que está instalado `bge-m3`; comprueba también `qwen2.5:3b` si vas a usar Ollama para generar texto.
4. Ejecuta manualmente la indexación; confirma puntos y dimensión en Qdrant.
5. Activa el workflow de consulta y prueba caminos `Respondida`, `Sin resultados` y `Error` con preguntas sintéticas. Luego integra las calificaciones e historial desde la UI/API.

Después de aplicar nuevos seeds, abre `RutaIA - Indexar cursos activos` en el editor y usa **Execute Workflow** para sincronizar sin activar el disparador periódico. Confirma que el conteo de puntos en `rutaia_courses` coincide con los cursos activos. `n8n execute --id` no puede ejecutar este flujo porque sus disparadores son Manual/Schedule y esa CLI requiere un nodo Execute Workflow Trigger; no agregues un trigger solo para una sincronización puntual.

La validación estática `cd backend; npm run validate:workflows` comprueba el JSON, conexiones y sintaxis de Code nodes; `npm test` cubre la lógica aislada con contexto sintético. Ambas son necesarias, pero ninguna reemplaza una ejecución n8n→Ollama→Qdrant→PostgreSQL de extremo a extremo.
