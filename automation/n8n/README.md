# Workflows de RutaIA en n8n

Los archivos `index-courses.json` y `answer-query.json` son workflows exportables y permanecen inactivos en Git. Los modelos se ejecutan con Ollama local; n8n no necesita credenciales de proveedor de IA ni envía cursos o preguntas a un servicio remoto.

## Requisitos y conexión Ollama

1. Instala/inicia Ollama en Windows y descarga los modelos configurados en `.env`:

   ```powershell
   ollama pull bge-m3
   ollama pull qwen2.5:3b
   ollama list
   ```

2. Ollama debe escuchar en una interfaz alcanzable desde Docker Desktop, porque dentro de los contenedores `localhost` es el propio contenedor. La configuración por defecto es `OLLAMA_BASE_URL=http://host.docker.internal:11434`. Comprueba la API local con `Invoke-RestMethod http://localhost:11434/api/tags` y desde el contenedor n8n con una petición a `http://host.docker.internal:11434/api/tags`. Si la segunda falla, corrige el enlace de red de Ollama/Windows Firewall según tu configuración; no publiques el puerto en Internet.
3. Configura `OLLAMA_EMBEDDING_MODEL=bge-m3` y `OLLAMA_CHAT_MODEL=qwen2.5:3b`. Usa el mismo modelo de embeddings para indexar y consultar. Qdrant creará la colección con la dimensión devuelta por Ollama; cambiar modelo puede requerir una colección nueva y reindexación.
4. Calibra `RAG_MIN_SIMILARITY` con preguntas pertinentes y fuera de dominio antes de activar la consulta.

Ollama no cobra inferencia; la descarga ocupa espacio local y la generación utiliza CPU/GPU y memoria de la PC. Las versiones fuente de los workflows llaman los endpoints nativos `/api/embed` y `/api/chat`, envían `stream:false` para respuesta y validan las dimensiones/estructura recibidas.

## Credenciales n8n

Los nodos internos conservan estas credenciales Header Auth; crea cada una en n8n y usa los secretos locales correspondientes:

| Nombre exacto | Header | Valor |
| --- | --- | --- |
| RutaIA - webhook bearer | `Authorization` | `Bearer <N8N_WEBHOOK_SECRET>` |
| RutaIA - secreto de sincronización | `X-N8N-Sync-Secret` | `N8N_COURSE_SYNC_SECRET` |
| RutaIA - callback Express | `X-N8N-Callback-Secret` | `N8N_CALLBACK_SECRET` |

No hay credencial para Ollama: la API local no exige clave por defecto. Las credenciales de integración se guardan cifradas por n8n y no se incluyen en el repositorio.

## Flujo de indexación

- Manual y cada seis horas: lee configuración y cursos activos por endpoints internos autenticados de Express/PostgreSQL.
- Construye los textos de curso y solicita lotes de embeddings a Ollama.
- Valida recuento, dimensión y valores finitos; crea colección Cosine cuando no existe y hace upsert con UUID del curso.
- Quita vectores obsoletos al reconciliar los cursos activos. Si el catálogo queda vacío, limpia Qdrant sin invocar Ollama.

## Flujo de consulta RAG

- Express envía consulta autenticada al webhook de n8n. El workflow consulta el catálogo, crea embedding local con Ollama y busca hasta 50 candidatos en Qdrant.
- Vuelve a comprobar que las fuentes existan y estén activas en PostgreSQL; aplica el umbral y limita las fuentes a cinco.
- Con tres o más fuentes llama Ollama con ese contexto y valida JSON con `answer`, `summary` y `explanation`; persiste resultado, fuentes y scores mediante callback autenticado de Express. Con menos de tres, devuelve `Sin resultados`.
- Las ramas de error hacen callback con un código genérico y no muestran detalles internos al estudiante.

## Importar y comprobar

1. En `http://localhost:5678`, crea la cuenta propietaria local e importa los dos JSON de esta carpeta.
2. Asigna las tres credenciales internas usando los nombres exactos de la tabla.
3. Mantén los workflows inactivos hasta comprobar `/api/tags` desde el contenedor y verificar que están instalados ambos modelos.
4. Ejecuta manualmente la indexación; confirma puntos y dimensión en Qdrant.
5. Activa el workflow de consulta y prueba caminos `Respondida`, `Sin resultados` y `Error` con preguntas sintéticas. Luego integra las calificaciones e historial desde la UI/API.

La validación estática `cd backend; npm run validate:workflows` comprueba el JSON, conexiones y sintaxis de Code nodes; `npm test` cubre la lógica aislada con contexto sintético. Ambas son necesarias, pero ninguna reemplaza una ejecución n8n→Ollama→Qdrant→PostgreSQL de extremo a extremo.
