# RutaIA

RutaIA es una aplicación web de orientación académica que busca cursos en un catálogo institucional y, cuando las integraciones están configuradas, genera recomendaciones RAG con fuentes verificables.

El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Se conservan los demás requisitos académicos y de la rúbrica.

**Modalidad:** desarrollo individual realizado por el estudiante autor del proyecto. La redacción grupal del enunciado no implica integrantes adicionales. Las operaciones académicas de catálogo, consultas, recomendaciones, fuentes e historial deben leer y escribir datos reales en PostgreSQL/Qdrant; fixtures sintéticos se limitan a pruebas aisladas y no se presentan como catálogo institucional.

## Requisitos

- Windows 10/11 con Docker Desktop (motor Linux) o una distribución Linux compatible con Docker Engine y Docker Compose v2.
- Git para clonar el repositorio.
- Para desarrollo del backend fuera de Docker: Node.js 22+ y npm.
- Catálogo institucional elegido: INTECAP. La [programación oficial de cursos](https://intecap.edu.gt/informacion-de-cursos/) enlaza el [listado y fichas de oferta](https://cursos.intecap.edu.gt/). Los seeds idempotentes `database/seeds/001`–`011` mantienen 37 cursos con fuente HTTPS. El catálogo local tiene 38 cursos activos y Qdrant 38 puntos con UUID coincidentes; un curso adicional administrado desde la app no tiene `source_url`. Los seeds 009–011 calculan las horas de ocho cursos desde sus calendarios oficiales y las describen como horas programadas, no como carga curricular oficial. El nivel didáctico `level` de RutaIA (Básico/Intermedio/Avanzado) y la clasificación oficial de carrera `intecapCareerType` (CTO/CTM/CTMS) se almacenan por separado; no se convierten entre sí. No asignar niveles ni horas faltantes sin respaldo oficial.
- Una clave propia de OpenRouter configurada localmente en `.env` para usar RAG. Los modelos gratuitos de embeddings y generación ya están definidos en la configuración; n8n nunca recibe la clave.

## Instalación y configuración inicial

Desde la raíz del repositorio:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edita `.env` localmente. No lo subas a Git ni compartas sus valores. Configura:

- `POSTGRES_PASSWORD`: contraseña aleatoria URL-safe (letras, números, `_` y `-`).
- `SESSION_SECRET` y `N8N_ENCRYPTION_KEY`: secretos aleatorios de al menos 32 caracteres.
- `JWT_SECRET` es opcional; úsalo solo si necesitas tokens Bearer. Debe ser independiente de `SESSION_SECRET`; sin él, la sesión-cookie normal sigue funcionando.
- `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` y `N8N_COURSE_SYNC_SECRET`: secretos distintos, aleatorios, de al menos 24 caracteres.
- `APP_PORT`: puerto local de la aplicación; por defecto 3000. En esta PC se usa 3001 porque 3000 estaba ocupado.
- `FRONTEND_URL`: origen del navegador; por ejemplo `http://localhost:3001` si cambias `APP_PORT` a 3001.
- `OPENROUTER_API_KEY`: pega la clave solo en este archivo local. Nunca la compartas por chat, Git, navegador ni n8n.
- `OPENROUTER_CHAT_MODEL` y `OPENROUTER_EMBEDDING_MODEL`: modelos gratuitos predeterminados `openrouter/free` y `nvidia/nemotron-3.5-embed-1b:free`. El backend rechaza modelos que no sean el router gratuito o terminen en `:free`.
- El proveedor de IA está fijado en OpenRouter; no se configura un selector de proveedor alternativo.
- `AI_CHAT_TIMEOUT_MS` y `AI_EMBEDDING_TIMEOUT_MS`: tiempos máximos de las solicitudes; por defecto 120 y 60 segundos.
- `RAG_MIN_SIMILARITY`: `.535` fue calibrado con BGE-M3 y no debe considerarse válido para el nuevo modelo. Recalibra con el script después de configurar OpenRouter y antes de activar consultas; consulta `docs/testing/acceptance-test-matrix.md`.

OpenRouter es obligatorio para embeddings y generación. El backend mantiene la clave y n8n solo llama a endpoints Express autenticados. La disponibilidad y las cuotas de modelos gratuitos pueden cambiar; los textos enviados salen de la computadora hacia OpenRouter. Usa preguntas sintéticas durante pruebas y no introduzcas información privada. En la comprobación actual, una solicitud confirmó embeddings de 2048 dimensiones, pero las siguientes recibieron HTTP 429 por límite de solicitudes; la generación aún no tiene una respuesta completa validada.

Para usarlo, edita solo tu `.env` local (no compartas la clave ni la pegues en n8n):

```dotenv
OPENROUTER_API_KEY=pega_aqui_tu_clave_local
OPENROUTER_CHAT_MODEL=openrouter/free
OPENROUTER_EMBEDDING_MODEL=nvidia/nemotron-3.5-embed-1b:free
```

Guarda el archivo y ejecuta `docker compose up -d backend` para que Compose actualice el entorno del contenedor. Nunca incluyas esa clave en el workflow ni crees una credencial OpenRouter en n8n. La indexación y las consultas solo aceptan `rutaia_courses_openrouter_2048` y embeddings de 2048 dimensiones; rechazan la colección antigua de 1024 dimensiones antes de escribir.

### Instalación desde cero en Linux

Requisitos: Git, Docker Engine con el complemento Docker Compose v2 y una clave local de OpenRouter. Los comandos siguientes usan Bash desde la raíz del repositorio.

```bash
cp .env.example .env
chmod 600 .env
```

Edita `.env` con los secretos locales requeridos arriba. Para una instalación nueva, reemplaza todos los `CHANGE_ME` y conserva la contraseña de PostgreSQL URL-safe. No compartas ni hagas commit de `.env`.

Completa `OPENROUTER_API_KEY` en `.env` antes de probar RAG. El proveedor de embeddings aún no se ha consultado en este entorno; no ejecutes la indexación hasta confirmar su dimensión frente a la colección existente.

Arranca y comprueba servicios:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl --fail http://localhost:${APP_PORT:-3000}/health/ready
curl --fail http://localhost:6333/readyz
curl --fail http://localhost:5678/healthz
```

Aplica, en orden, los once seeds listados abajo con `docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1 < database/seeds/001_intecap_programacion_plc.sql` y repite con los archivos 002–011. El usuario predeterminado es `rutaia_user`; si se personalizó `POSTGRES_USER`, úsalo en `psql`. En una instalación n8n nueva, importa los dos JSON de `automation/n8n/` y crea/asigna las tres credenciales descritas en `automation/n8n/README.md`. El indexador debe permanecer inactivo; no lo ejecutes hasta verificar la dimensión que devuelve el modelo OpenRouter y confirmar que es compatible con Qdrant. Después, una indexación manual está autorizada; no actives el disparador periódico. Configura el workflow de consulta solo después de calibrar el umbral y completar pruebas autorizadas. Abre `http://localhost:${APP_PORT:-3000}`.

Para detener y reanudar en Linux:

```bash
docker compose stop       # conserva contenedores y volúmenes
docker compose start
docker compose down       # elimina contenedores/red, conserva datos
```

No uses `docker compose down -v` para la presentación: borra los datos persistentes de PostgreSQL, Qdrant y n8n. Compose y la resolución `host-gateway` están configurados para Linux, pero en esta sesión solo se verificó el motor Linux de Docker Desktop en Windows; aún falta ejecutar el instructivo en un host Linux real.

Los workflows versionados envían embeddings y solicitudes de generación a proxies internos autenticados de Express. Las exportaciones JSON permanecen inactivas; actualizar estos archivos no actualiza por sí solo los workflows guardados en una instancia n8n.

## Iniciar con Docker Compose

Desde la raíz, con Docker Desktop iniciado:

```powershell
docker compose up --build -d
docker compose ps
```

Compose levanta PostgreSQL, Qdrant, n8n y Express. La API aplica las migraciones al arrancar. En el `.env` actual de esta PC, la app está en `http://localhost:3001`; n8n en `http://localhost:5678`; PostgreSQL en `localhost:5432`; Qdrant en `http://localhost:6333`. Los puertos publicados están limitados a loopback.

Para cargar el catálogo oficial actualmente curado, aplica estos seeds idempotentes después del arranque:

```powershell
Get-Content -Raw .\database\seeds\001_intecap_programacion_plc.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\002_intecap_analisis_datos_excel_powerbi.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\003_intecap_formacion_tecnica.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\004_intecap_catalogo_2027.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\005_intecap_source_urls.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\006_intecap_tic_catalog_2027.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\007_intecap_tic_catalog_extension.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\008_intecap_automatizacion_industrial.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\009_intecap_inteligencia_artificial.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\010_intecap_ciberseguridad_powerbi.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
Get-Content -Raw .\database\seeds\011_intecap_java_powerbi_basico.sql | docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1
```

Los once seeds son idempotentes. Los seeds 001–008 cargan 29 ofertas; los seeds 009, 010 y 011 agregan tres, tres y dos respectivamente, para 37 cursos mantenidos por seed. El seed 011 añade [Lenguaje de programación Java (E-learning)](https://cursos.intecap.edu.gt/detalle/45278/2026) y [Power BI básico](https://cursos.intecap.edu.gt/detalle/43108/2026). Sus 40 y 20 horas se calculan desde el calendario y horario oficiales; las fichas no publican una carga curricular total. La descripción etiqueta explícitamente esas cifras como horas programadas, no curriculares. Los seeds 009–011 identifican del mismo modo las horas calculadas y no descuentan pausas no especificadas. Los enlaces oficiales de IA son 46350, 46366 y 47794; el seed 010 añade [Power BI intermedio](https://cursos.intecap.edu.gt/detalle/45525/2026), [FortiGate Administrator](https://cursos.intecap.edu.gt/detalle/45419/2026) y [Fundamentos de ciberseguridad, nube y firewalls](https://cursos.intecap.edu.gt/detalle/40370/2026). Los seeds 006–008 suman nueve ofertas TIC/automatización con horas respaldadas en páginas y publicaciones oficiales. El seed 008 agrega Automatización Industrial (360 h) e Instrumentista Industrial (540 h de formación más 300 h de práctica separada), según la [especialidad industrial de INTECAP Baja Verapaz](https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/). Después de aplicar un seed, confirma que los UUID de cursos activos coincidan con Qdrant, pero no ejecutes la indexación hasta verificar la dimensión del modelo. Las tarjetas de catálogo y las fuentes RAG enlazan a la fuente institucional. `level` es la clasificación pedagógica de RutaIA según objetivos/requisitos, no un CTO/CTM/CTMS; `intecap_career_type` queda NULL si la ficha no publica esa clasificación. Algunas fichas publican horas de práctica por separado; `duration_hours` conserva las horas de formación y la práctica separada se explica en la descripción. Si cambiaste `POSTGRES_USER` o el nombre de base, ajusta `-U`/`-d`. RAG requiere además Qdrant, clave OpenRouter, workflows sincronizados y calibración del umbral.

`courses.intecap_career_type` conserva por separado CTO/CTM/CTMS, si la ficha identifica una carrera de esa clasificación. En ofertas modulares como PLC queda `NULL`; `courses.level` continúa expresando dificultad didáctica de RutaIA.

Comprueba la API y las dependencias:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/health/ready
Invoke-RestMethod http://localhost:3001/api/v1/courses?limit=100&page=1
Invoke-RestMethod http://localhost:6333/readyz
```

En una instalación que use el puerto predeterminado, reemplaza `3001` por `3000`. `/health/ready` verifica la conexión PostgreSQL. `docker compose ps` debe mostrar los cuatro servicios de RutaIA como `healthy`. No uses `docker compose down -v`: borraría los volúmenes persistentes.

### Direcciones de los servicios y páginas JSON

- **Qdrant** expone una API REST en `http://localhost:6333`; abrir la raíz puede mostrar una respuesta JSON de bienvenida. El panel visual está en [`http://localhost:6333/dashboard`](http://localhost:6333/dashboard). El endpoint `/readyz` es una sonda JSON de disponibilidad, no una pantalla de gestión. La UI oficial de Qdrant local usa esa ruta `/dashboard` ([documentación Qdrant](https://qdrant.tech/documentation/web-ui/)).
- **PostgreSQL** escucha en el puerto `5432` con el protocolo cliente/servidor propio de PostgreSQL, no HTTP. Por eso abrir `http://localhost:5432` en Chrome no muestra un sitio y puede indicar que la página no responde. Conéctate con `docker compose exec postgres psql -U rutaia_user -d rutaia` o usa un cliente como pgAdmin/DBeaver. El protocolo es TCP y el puerto 5432 es el valor convencional ([documentación PostgreSQL](https://www.postgresql.org/docs/current/protocol.html)).
- **Aplicación** `http://localhost:3000` (o el `APP_PORT` de `.env`) y **n8n** `http://localhost:5678` sí son interfaces web.

## Detener y reanudar

Desde la misma carpeta y con el mismo `.env`:

```powershell
docker compose stop       # Detiene los servicios del proyecto y conserva contenedores/volúmenes
docker compose start      # Los inicia nuevamente
docker compose down       # Elimina contenedores/red del proyecto; conserva volúmenes
```

No ejecutes `down -v` si necesitas conservar PostgreSQL, Qdrant o datos de n8n. Estos comandos operan solo sobre el proyecto Compose `rutaia`; no incluyen Home Assistant ni MongoDB.

## Comprobar integraciones y RAG

- La API usa `postgres` para la base relacional. `GET /health/ready` comprueba esa conexión.
- Backend y n8n se conectan por DNS interno Compose (`backend:3000`, `n8n:5678`); n8n consulta cursos activos/configuración a Express, consulta Qdrant y envía resultados a callbacks autenticados.
- Qdrant usa exclusivamente `rutaia_courses_openrouter_2048` para el modelo nuevo; backend y workflows rechazan cualquier otro destino. La colección anterior `rutaia_courses` de 1024 dimensiones se conserva intacta. `GET http://localhost:6333/collections` permite inspeccionarlas.
- n8n presenta su interfaz en `http://localhost:5678`. Los nodos de embeddings y generación deben usar la credencial de sincronización hacia los proxies internos Express. Editar los JSON locales no actualiza los workflows ya guardados en n8n; consulta [la guía](automation/n8n/README.md). No se ha modificado la instancia activa ni se ha reindexado Qdrant.
- `docker compose ps` saludable y una respuesta sintética de callback **no** prueban el RAG completo. Consulta configuración y pruebas de los workflows en [automation/n8n/README.md](automation/n8n/README.md).

## Pruebas y validaciones

Desde `backend/`:

```powershell
npm ci
npm test
npm run test:integration
npm run validate:openapi
npm run validate:workflows
npm audit
npm run calibrate:rag
```

La suite `npm test` incluye pruebas aisladas de los proxies con respuestas simuladas, lógica de Code nodes y cliente n8n, sin depender de PostgreSQL; la integración de DB aparece omitida en esa suite. La validación OpenAPI parsea YAML, coteja operaciones con routers/montajes de `src/app.js`, resuelve referencias locales y exige esquemas para cada respuesta exitosa 200/201/202. `npm run validate:workflows` revisa JSON, nombres/IDs, conexiones y sintaxis de Code nodes en ambos workflows. `npm run calibrate:rag` requiere clave configurada y hace una solicitud de embeddings a OpenRouter con un lote de datos del catálogo y preguntas sintéticas; no lo ejecutes sin autorización explícita. reporta 0 vulnerabilidades; se quitó `nodemon` y el script dev usa el watcher nativo de Node 22. Las pruebas RAG usan fixtures/contexto simulado y no sustituyen ejecutar los workflows en n8n con Qdrant y proveedor reales.

**Calibración histórica con BGE-M3:** la última ejecución anterior a esta migración consultó el catálogo local y no escribió en Qdrant ni envió datos a proveedores externos. Con 38 cursos y 22 casos, el tercer score máximo fuera de dominio fue `0.5292` y el tercer score positivo mínimo `0.5396`; se usó `.535`. Esas mediciones no son aplicables al nuevo modelo OpenRouter. El calibrador actual envía un lote al proxy OpenRouter y requiere clave configurada y autorización antes de ejecutarse.

La integración contra PostgreSQL real utiliza exclusivamente una base local llamada `rutaia_test`. Levanta Compose y configura en `.env` `RUTAIA_TEST_DATABASE_URL`, usando el usuario/contraseña local y la ruta `/rutaia_test`. Crea la base una sola vez si aún no existe:

El formato esperado es `postgresql://rutaia_user:<contraseña-url-safe>@localhost:5432/rutaia_test`; reemplaza el usuario/contraseña por los de tu `.env` sin pegar el valor en Git.

```powershell
docker exec rutaia-postgres-1 createdb -U rutaia_user rutaia_test
```

Luego, desde `backend/`:

```powershell
npm run test:integration
```

El runner rechaza otros hosts o nombres de base y la prueba elimina sus fixtures. No apuntes esa variable a una base con datos reales. La integración valida API/DB y callbacks sintéticos, no ejecuta los workflows n8n ni llama a OpenRouter.

Para desarrollar Express fuera de Docker: configura `DATABASE_URL` en `.env`, instala dependencias con `npm ci` desde `backend/` y ejecuta `npm run dev`. Para aplicar una migración manual contra la base local configurada: `npm run db:migrate`.

## API y código

La especificación está en [docs/api/openapi.yaml](docs/api/openapi.yaml); su verificador es `cd backend; npm run validate:openapi`. Rutas principales:

- Auth y sesión: `/api/v1/auth/*`.
- Perfil e historial: `/api/v1/students/*`, `/api/v1/queries/*`.
- Catálogo público/admin: `/api/v1/courses`, `/api/v1/admin/courses`.
- Calificaciones y métricas: `/api/v1/recommendations/{id}/rating`, `/api/v1/admin/statistics`.
- Callback/sincronización internos: `/api/v1/internal/*`.

El navegador habla solo con Express. Las mutaciones de sesión necesitan cookie HttpOnly y header `X-CSRF-Token`. Para conceder rol admin a una cuenta previamente registrada: `npm run admin:promote -- admin@example.com` desde `backend/`; el comando no crea contraseñas ni cuentas.

JWT Bearer está disponible en `POST /api/v1/auth/token` si se configura `JWT_SECRET`; la sesión-cookie sigue siendo el comportamiento predeterminado. Las consultas aceptan filtros opcionales de categoría/nivel y usan hasta tres respuestas previas del mismo estudiante como memoria. `GET /api/v1/queries/export.csv` exporta únicamente el historial del usuario autenticado.

## Estado comprobado en este entorno — 5 de noviembre de 2026

**Estado de OpenRouter y funciones locales — 5 nov 2026:** los proxies y workflows versionados están actualizados. `npm test` pasa (63 pruebas, 0 fallidas, 1 integración opcional omitida), la integración PostgreSQL/API pasa 1/1, OpenAPI valida 32 rutas/35 operaciones/120 referencias, workflows valida 40 nodos y Compose valida. Se implementaron JWT Bearer opcional, filtros Qdrant, memoria por estudiante, exportación CSV y sincronización incremental; hay pruebas automatizadas. La migración 005 figura aplicada en `rutaia` y `rutaia_test`, pero los workflows siguen inactivos y la instancia n8n no se modificó. Una solicitud anterior confirmó embeddings de 2048 dimensiones; una petición sintética al proxy el 5 nov devolvió 502 `AI_PROVIDER_RATE_LIMITED`, así que no hay generación completa ni RAG OpenRouter validado. Qdrant conserva intacta `rutaia_courses` (1024 dimensiones, 38 puntos); `rutaia_courses_openrouter_2048` aún no existe. La consulta de cuota no expuso el saldo diario gratuito. No activar/reindexar hasta resolver el límite, calibrar, indexar el catálogo y validar RAG integral.

**Actualización de esta continuación:** se aplicaron los seeds 009–011. El catálogo curado por seeds suma 37 cursos; la base local tiene 38 activos y Qdrant 38 puntos, con cero UUID faltantes y cero huérfanos. El indexador se ejecutó manualmente en CLI con broker 5680, sin activar el workflow. La recalibración BGE-M3 cubre 38 cursos/22 casos, conserva `.535` con ventana `0.5292–0.5396` y obtiene 1,1,2,1,3,3,0 para páginas web, Java/Spring, dashboards, automatización empresarial, IA, ciberseguridad y contenedores. Java/E-learning puntúa 0.5302 para Java/Spring y queda bajo el umbral; Power BI básico no eleva dashboards de 2/3. Ciberseguridad general llega a 3/3, pero no demuestra formación específica en seguridad web. No se ejecutó una nueva consulta persistida; la calibración solo compara embeddings. El workflow de indexación permanece manual/inactivo, con autorización docente confirmada. Los cuatro contenedores son Linux sobre Docker Desktop en Windows, no un host Linux nativo.

**Evidencia histórica de la integración anterior:** antes de fijar OpenRouter se usaba un selector Ollama/OpenRouter. El backend y el workflow llegaron a probarse con Ollama local; esa evidencia no demuestra que la migración actual funcione. La instancia n8n activa requiere actualización manual y esta sesión no ha modificado workflows desplegados.

**Verificación adicional (4 nov):** el conjunto `npm ci` + pruebas + validadores + auditoría pasó en Node `v22.23.4` dentro de un contenedor Linux temporal; `npm audit` reportó cero vulnerabilidades. La imagen de producción se reconstruyó con `npm ci --omit=dev` (cero vulnerabilidades), se reemplazó el servicio backend y volvió a responder `ready`. Esto sigue siendo Linux en Docker Desktop sobre Windows, no un host Linux nativo.

- `docker compose --env-file .env config --quiet` y `docker compose up --build -d` pasaron. Los cuatro servicios quedaron `healthy`. Desde los contenedores se comprobaron respuestas HTTP 200 backend→n8n, backend→Qdrant, n8n→backend y n8n→Qdrant; PostgreSQL está listo para la API.
- 3 nov: tras migrar RAG a Ollama, `docker compose up --build -d` reconstruyó solo backend y los cuatro servicios quedaron saludables. `n8n` recibió HTTP 200 en `host.docker.internal:11434/api/tags`; se instalaron localmente `bge-m3` y `qwen2.5:3b`.
- 3 nov: se actualizaron por sus IDs existentes los dos workflows n8n (14 nodos cada uno); en aquella revisión ambos seguían inactivos y no había duplicados. Una prueba temporal leyó 20 cursos, creó embeddings BGE‑M3 de 1024 dimensiones, indexó/buscó en Qdrant, recibió cinco fuentes y obtuvo respuesta JSON válida de Qwen; borró la colección temporal. Después se activó el workflow de consulta para una prueba local; el de indexación sigue inactivo.
- Verificación previa a seed 008 (3 nov): `npm test` 26 aprobadas, 0 fallidas y 1 integración optativa omitida; `npm run test:integration` 1 aprobada contra `rutaia_test`, con seeds 001–007; OpenAPI validó 25 paths/28 operaciones/95 refs; workflows validó 28 nodos, 33 conexiones y 9 Code nodes.
- Verificación anterior al seed 008: `npm test` 26 aprobadas, 0 fallidas y 1 integración optativa omitida; `npm run test:integration` 1 aprobada contra `rutaia_test`; OpenAPI validó 25 paths/28 operaciones/95 refs; workflows validó 28 nodos, 33 conexiones y 9 Code nodes.
- **Snapshot anterior (antes del seed 009):** el catálogo tenía 29 cursos y 29 puntos sincronizados. Se conserva como evidencia histórica de esa ejecución; el estado actual aparece en la actualización de esta sección.
- La recalibración actual BGE-M3 (22 casos, 38 cursos, umbral `0.535`) mantiene el filtro de pertinencia. IA obtiene 3 fuentes oficiales; páginas web 1; Java/Spring 1; dashboards 2; automatización empresarial 1 fuente industrial (no equivalente a automatización administrativa); ciberseguridad general 3 (no demuestra seguridad web específica); contenedores 0. Las dos ofertas nuevas no cambiaron los resultados de Java/Spring ni dashboards. No se bajó el umbral para forzar resultados.
- **E2E previa al seed 009:** registro (201), login (200), catálogo (29), consulta (202) y resultado `Respondida` en 65 s con tres fuentes INTECAP; historial (200) y calificación (201). La consulta de IA posterior al seed 009 terminó `Respondida` con las tres fichas oficiales IA, historial (200) y rating (201). En ambas pruebas se limpiaron cuentas y registros sintéticos. Cocina italiana había terminado `Sin resultados` en una E2E previa.
- **Corrección de timeout RAG:** el workflow local generó hasta 768 tokens y la llamada al modelo agotó el límite HTTP de 300 s. Se acotó la salida a 192 tokens y a tres campos breves. La misma consulta E2E ahora termina en 65 s. Una prueba aislada de Qwen generó JSON válido con 49 tokens en 21 s. El filtro pasa al modelo solo las tres fuentes activas mejor clasificadas.
- **Cobertura restante:** con 38 cursos, solo IA alcanza tres fuentes claramente pertinentes dentro de las siete preguntas académicas medidas. Ciberseguridad general obtiene tres fuentes para la pregunta sobre aplicaciones web, pero no prueba formación específica de seguridad web. Java/web, dashboards, automatización empresarial y contenedores necesitan más cursos institucionales pertinentes; la oferta de automatización industrial no equivale a automatización administrativa. Tampoco se verificó una ficha Docker/Kubernetes con duración oficial. No reemplazar faltantes con cursos inventados ni equiparar automáticamente cloud/Linux a contenedores.
- **Validación previa a esta revisión:** `npm test` 26 aprobadas, 0 fallidas y 1 prueba de integración optativa omitida; `npm run test:integration` 1/1; OpenAPI 25 paths/28 operaciones/95 refs; workflows 28 nodos/33 conexiones/9 Code nodes. El resultado actualizado de proveedor está descrito arriba.
- El indexador n8n también se ejecutó con un curso institucional temporalmente inactivo: Qdrant pasó de 20 a 19 puntos y retiró ese vector; tras reactivar el curso y repetir el flujo volvió a 20 puntos y recuperó el UUID. Se verificó que el curso quedó activo.
- El flujo Git local usa `trabajo` (desarrollo), `dev` (integración) y `main` (estable). Revisa `git status` antes de continuar.

## Continuidad

Lee [docs/MANUAL_PROYECTO.md](docs/MANUAL_PROYECTO.md) para el mapa de servicios, variables, pruebas, estado por flujo y orden recomendado para retomar.

La presentación académica editable está en [docs/entrega/RutaIA_presentacion_final.pptx](docs/entrega/RutaIA_presentacion_final.pptx). Resume la arquitectura y las evidencias disponibles, incluye la cobertura real de la rúbrica y propone un guion de sustentación de 10–15 minutos.
