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
- Exige `provider.zdr=true` y `provider.data_collection="deny"` en la petición de embeddings; si el modelo no tiene endpoint elegible, la llamada falla y no degrada silenciosamente la política de datos.
- Comprueba cantidad, dimensión y valores finitos del vector.
- Crea la colección Cosine si aún no existe, hace upsert usando el UUID del curso como ID estable y elimina puntos cuyo curso dejó de estar activo durante la reconciliación.
- Antes de esa reconciliación, la búsqueda vuelve a consultar PostgreSQL y descarta cursos inactivos; recupera una ventana interna de candidatos de hasta 50 para que vectores obsoletos no impidan encontrar cinco cursos activos, y nunca envía más de cinco fuentes al modelo.
- Si se cambia de modelo y la dimensión no coincide con la colección existente, usa un nombre nuevo en `QDRANT_COLLECTION` y reindexa; no borres una colección persistida para resolver el conflicto.

## `answer-query.json`

- Expone el webhook POST `/webhook/rutaia-query`, autenticado con el header `Authorization` que envía Express. Responde al API al aceptar la ejecución; el procesamiento continúa en n8n.
- Lee de PostgreSQL el conjunto de cursos activos, embebe la pregunta con el modelo compartido, busca hasta 50 candidatos en Qdrant y vuelve a validar existencia/actividad contra PostgreSQL; limita las fuentes finales a cinco.
- La consulta de embedding y la generación de respuesta exigen endpoints ZDR y rechazan proveedores con recopilación de datos. En la respuesta también se requiere que el proveedor admita los parámetros pedidos. Esto restringe retención en los endpoints que procesan inferencia; la petición sigue saliendo a un proveedor externo y no implica aprobación institucional para enviar datos reales.
- Aplica el umbral enviado por Express. Si quedan menos de tres fuentes, envía el estado `Sin resultados` al callback.
- Si quedan tres a cinco fuentes, llama al modelo generativo con solo esos cursos y persiste respuesta, explicación, resumen, UUIDs y scores mediante el callback autenticado de Express.
- Los fallos HTTP y de validación de la ruta principal se convierten en un callback `Error` con código genérico; los detalles de proveedores no se envían al estudiante.

## Activación y configuración

1. Copia `.env.example` a `.env` y sustituye todos los valores `CHANGE_ME` por secretos aleatorios. Usa caracteres URL seguros (`A-Z`, `a-z`, `0-9`, `_`, `-`) para la contraseña PostgreSQL, porque Compose la inserta en `DATABASE_URL`.
2. Baseline configurado en `.env.example`: `baai/bge-m3` para embeddings (1024 dimensiones, multilingüe, contexto 8K) y `meta-llama/llama-3.3-70b-instruct` para respuesta en español con salida JSON. Verifica de nuevo disponibilidad, precio y endpoints elegibles antes de ejecutar; los datos del catálogo y las preguntas se procesan en un proveedor externo. Los workflows fuerzan ZDR y `data_collection=deny`; no envíes consultas estudiantiles reales sin autorización de privacidad institucional. Registra la clave como credencial Header Auth cifrada en n8n; nunca en `.env` o frontend.
3. No rellenes `RAG_MIN_SIMILARITY` hasta calibrarlo con preguntas pertinentes y fuera de dominio, catálogo autorizado y escala real del modelo/Qdrant.
4. Ejecuta `docker compose up --build`; crea la cuenta propietaria de n8n, importa ambos JSON y asigna las credenciales.
5. Ejecuta `index-courses.json` manualmente y comprueba el upsert exitoso en la ejecución y en Qdrant. Confirma que la colección tiene la dimensión del modelo seleccionado.
6. Activa los workflows en n8n. Activar `answer-query.json` registra su URL de producción; debe coincidir con `N8N_QUERY_WEBHOOK_URL` (`http://n8n:5678/webhook/rutaia-query` dentro de Compose).
7. Prueba los caminos `Respondida`, `Sin resultados` y `Error` con catálogo y preguntas autorizados antes de una demostración.

## Baseline de modelos y privacidad

- Embeddings: [`baai/bge-m3`](https://openrouter.ai/baai/bge-m3), modelo multilingüe con vectores de 1024 dimensiones y contexto de 8K tokens.
- Generación: [`meta-llama/llama-3.3-70b-instruct`](https://openrouter.ai/meta-llama/llama-3.3-70b-instruct), admite español y salida estructurada.
- Los tres nodos que envían contenido a OpenRouter fuerzan `provider.zdr=true` y `provider.data_collection="deny"`; la generación además exige que el endpoint acepte los parámetros pedidos. Consulta la [política de enrutamiento](https://openrouter.ai/docs/guides/routing/provider-selection) y la [política de privacidad](https://openrouter.ai/privacy). OpenRouter transmite el texto al proveedor para inferencia; ZDR no convierte la inferencia en local ni sustituye autorización institucional. La política ZDR tiene excepciones de revisión/retención legal para contenido marcado. Los endpoints elegibles, precios y disponibilidad pueden cambiar y se deben verificar con la clave antes de activar.
- El JSON fuente contiene estas restricciones. Las copias importadas en la instancia n8n aún no se actualizaron, están inactivas y no se han probado con credenciales. No se ha enviado texto del catálogo ni consultas a OpenRouter.

Compose limita PostgreSQL, Qdrant, n8n y la aplicación a `127.0.0.1`. Es una topología local de desarrollo; no publiques esos puertos directamente en Internet. n8n no guarda payloads de ejecución exitosos ni fallidos, reduce exposición de preguntas, y elimina metadatos antiguos después de siete días.

## Estado de verificación

Los dos workflows se importaron en la instancia local n8n 2.46.4 y se verificaron en su base de datos como inactivos. `cd backend; npm run validate:workflows` valida JSON, conexiones y compilación de sus ocho Code nodes. `backend/tests/n8n-code-nodes.test.js` ejecuta cuatro pruebas aisladas sobre selección de fuentes y validación de embeddings usando contexto simulado. `backend/tests/n8n-client.test.js` prueba configuración, payload y traducción de errores con `fetch` simulado. Esto cubre estructura y parte de la lógica, pero no credenciales, operación del workflow, llamadas externas ni RAG de extremo a extremo. Los IDs de modelo son un baseline documentado; la clave, disponibilidad de proveedores ZDR y ejecución integral siguen pendientes.
