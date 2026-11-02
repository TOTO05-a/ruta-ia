# Workflows de RutaIA en n8n

Los dos JSON son exportaciones importables; llegan inactivos y sin credenciales. Las credenciales no se guardan en Git ni dentro del JSON. Antes de activar, importa cada workflow, asigna las credenciales indicadas y ejecuta una indexación manual con cursos institucionales autorizados.

## Credenciales que se asignan desde n8n

Crea credenciales de tipo **Header Auth** y asígnalas en los nodos nombrados. Los valores deben coincidir exactamente con el `.env` local:

| Nombre sugerido | Header | Valor |
| --- | --- | --- |
| RutaIA - webhook bearer | `Authorization` | `Bearer <N8N_WEBHOOK_SECRET>` |
| RutaIA - secreto de sincronización | `X-N8N-Sync-Secret` | `N8N_COURSE_SYNC_SECRET` |
| RutaIA - OpenRouter Bearer | `Authorization` | `Bearer <clave API de OpenRouter>` |
| RutaIA - callback Express | `X-N8N-Callback-Secret` | `N8N_CALLBACK_SECRET` |

No introduzcas la clave de OpenRouter en `backend`, el frontend, expresiones `$env` ni archivos del repositorio. El acceso a variables de entorno desde nodos/código de n8n está deshabilitado en Compose. La clave se conserva como credencial cifrada de n8n.

## `index-courses.json`

- Inicia manualmente o se ejecuta cada seis horas.
- Lee configuración de modelo, colección y URL de Qdrant desde el endpoint interno autenticado.
- Obtiene exclusivamente cursos activos de PostgreSQL.
- Embebe nombre, descripción, categoría, nivel y duración con OpenRouter.
- Comprueba cantidad, dimensión y valores finitos del vector.
- Crea la colección Cosine si aún no existe y hace upsert usando el UUID del curso como ID estable.
- Al desactivar un curso, el vector puede permanecer hasta una futura limpieza; la búsqueda RAG vuelve a consultar PostgreSQL y descarta todo curso inactivo, así que no debe recomendarse.

## `answer-query.json`

- Expone el webhook POST `/webhook/rutaia-query`, autenticado con el header `Authorization` que envía Express. Responde al API al aceptar la ejecución; el procesamiento continúa en n8n.
- Lee de PostgreSQL el conjunto de cursos activos, embebe la pregunta con el modelo compartido, busca como máximo cinco puntos en Qdrant y vuelve a validar existencia/actividad contra PostgreSQL.
- Aplica el umbral enviado por Express. Si quedan menos de tres fuentes, envía el estado `Sin resultados` al callback.
- Si quedan tres a cinco fuentes, llama al modelo generativo con solo esos cursos y persiste respuesta, explicación, resumen, UUIDs y scores mediante el callback autenticado de Express.
- Los fallos HTTP y de validación de la ruta principal se convierten en un callback `Error` con código genérico; los detalles de proveedores no se envían al estudiante.

## Activación y configuración

1. Copia `.env.example` a `.env` y sustituye todos los valores `CHANGE_ME` por secretos aleatorios. Usa caracteres URL seguros (`A-Z`, `a-z`, `0-9`, `_`, `-`) para la contraseña PostgreSQL, porque Compose la inserta en `DATABASE_URL`.
2. Elige modelos de embeddings/chat que estén disponibles y revisa retención/uso de datos del proveedor antes de mandar preguntas reales. Coloca los identificadores exactos en `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_CHAT_MODEL`. Configura la credencial OpenRouter indicada arriba en n8n.
3. No rellenes `RAG_MIN_SIMILARITY` hasta calibrarlo con preguntas pertinentes y fuera de dominio, catálogo autorizado y escala real del modelo/Qdrant.
4. Ejecuta `docker compose up --build`; crea la cuenta propietaria de n8n, importa ambos JSON y asigna las credenciales.
5. Ejecuta `index-courses.json` manualmente y comprueba el upsert exitoso en la ejecución y en Qdrant. Confirma que la colección tiene la dimensión del modelo seleccionado.
6. Activa los workflows en n8n. Activar `answer-query.json` registra su URL de producción; debe coincidir con `N8N_QUERY_WEBHOOK_URL` (`http://n8n:5678/webhook/rutaia-query` dentro de Compose).
7. Prueba los caminos `Respondida`, `Sin resultados` y `Error` con catálogo y preguntas autorizados antes de una demostración.

Compose limita PostgreSQL, Qdrant, n8n y la aplicación a `127.0.0.1`. Es una topología local de desarrollo; no publiques esos puertos directamente en Internet. n8n no guarda payloads de ejecución exitosos ni fallidos, reduce exposición de preguntas, y elimina metadatos antiguos después de siete días.

## Estado de verificación

Los JSON están pendientes de importación y ejecución porque Docker Desktop no permite conectar al daemon en este entorno. La sintaxis JSON, referencias entre nodos y JavaScript incluido se verifican localmente; esa revisión estática no acredita que los nodos/credenciales funcionen en la versión ejecutada de n8n.
