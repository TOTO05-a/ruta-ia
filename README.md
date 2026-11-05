# RutaIA

RutaIA es una aplicación web de orientación académica que busca cursos en un catálogo institucional y, cuando las integraciones están configuradas, genera recomendaciones RAG con fuentes verificables.

El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Se conservan los demás requisitos académicos y de la rúbrica.

**Modalidad:** desarrollo individual realizado por el estudiante autor del proyecto. La redacción grupal del enunciado no implica integrantes adicionales. Las operaciones académicas de catálogo, consultas, recomendaciones, fuentes e historial deben leer y escribir datos reales en PostgreSQL/Qdrant; fixtures sintéticos se limitan a pruebas aisladas y no se presentan como catálogo institucional.

## Requisitos

- Windows 10/11 con Docker Desktop (motor Linux) o una distribución Linux compatible con Docker Engine y Docker Compose v2.
- Git para clonar el repositorio.
- Para desarrollo del backend fuera de Docker: Node.js 22+ y npm.
- Catálogo institucional elegido: INTECAP. La [programación oficial de cursos](https://intecap.edu.gt/informacion-de-cursos/) enlaza el [listado y fichas de oferta](https://cursos.intecap.edu.gt/). Los seeds idempotentes `database/seeds/001`–`011` mantienen 37 cursos con fuente HTTPS. El catálogo local tiene 38 cursos activos y Qdrant 38 puntos con UUID coincidentes; un curso adicional administrado desde la app no tiene `source_url`. Los seeds 009–011 calculan las horas de ocho cursos desde sus calendarios oficiales y las describen como horas programadas, no como carga curricular oficial. El nivel didáctico `level` de RutaIA (Básico/Intermedio/Avanzado) y la clasificación oficial de carrera `intecapCareerType` (CTO/CTM/CTMS) se almacenan por separado; no se convierten entre sí. No asignar niveles ni horas faltantes sin respaldo oficial.
- Ollama instalado localmente con `bge-m3` y, si se usa la opción local de generación, `qwen2.5:3b`. Las embeddings continúan locales con Ollama en ambas opciones.

## Instalación y configuración inicial

Desde la raíz del repositorio:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edita `.env` localmente. No lo subas a Git ni compartas sus valores. Configura:

- `POSTGRES_PASSWORD`: contraseña aleatoria URL-safe (letras, números, `_` y `-`).
- `SESSION_SECRET` y `N8N_ENCRYPTION_KEY`: secretos aleatorios de al menos 32 caracteres.
- `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` y `N8N_COURSE_SYNC_SECRET`: secretos distintos, aleatorios, de al menos 24 caracteres.
- `APP_PORT`: puerto local de la aplicación; por defecto 3000. En esta PC se usa 3001 porque 3000 estaba ocupado.
- `FRONTEND_URL`: origen del navegador; por ejemplo `http://localhost:3001` si cambias `APP_PORT` a 3001.
- `OLLAMA_BASE_URL`: desde Docker Compose usa `http://host.docker.internal:11434` para alcanzar Ollama en Windows.
- `OLLAMA_EMBEDDING_MODEL` y `OLLAMA_CHAT_MODEL`: por defecto `bge-m3` y `qwen2.5:3b`. El modelo de embeddings siempre se necesita; descarga el de chat solo si `AI_PROVIDER=ollama`.
- `AI_PROVIDER`: `ollama` (predeterminado, local) o `openrouter` (solo generación de texto; embeddings de Ollama y búsqueda en el Qdrant local).
- `OPENROUTER_API_KEY` y `OPENROUTER_CHAT_MODEL`: para OpenRouter, guarda la clave únicamente en `.env` y deja el modelo como `openrouter/free` o elige un ID terminado en `:free`. El backend rechaza IDs que no sean gratuitos y mantiene la clave fuera de n8n, del navegador y del workflow. Para no usar una API externa, conserva `AI_PROVIDER=ollama`.
- `AI_CHAT_TIMEOUT_MS`: tiempo máximo para la llamada al modelo, por defecto 120 segundos; es configurable hasta 180 segundos para hardware más lento.
- `RAG_MIN_SIMILARITY`: entorno local `0.535`. La recalibración BGE-M3 de esta revisión cubre 38 cursos activos y 22 casos con el mismo texto que n8n usa para indexarlos. La ventana observada entre el mayor tercer score fuera de dominio y el menor tercer score positivo es `0.5292–0.5396`; `.535` queda dentro, con margen estrecho. El curso Java nuevo puntúa `0.5302` para la pregunta Java/Spring y queda bajo el umbral; el caso de dashboards sigue en 2/3. Esto no garantiza grounding y requiere ampliar casos etiquetados. Consulta `docs/testing/acceptance-test-matrix.md`; recalibra al cambiar catálogo o modelo.

OpenRouter es una opción conectada al backend; no se necesita para arrancar el proyecto. La lista de modelos y límites gratuitos puede cambiar: el backend solo permite el alias `openrouter/free` o IDs que terminen en `:free`, pero esa restricción no garantiza disponibilidad permanente del proveedor. Los modelos gratuitos son limitados por cuota y los textos enviados salen de la computadora hacia el proveedor elegido; usa preguntas sintéticas durante pruebas. Las páginas de OpenRouter indican que `openrouter/free` enruta a modelos gratuitos y que las variantes gratuitas tienen límites de uso ([modelos gratuitos](https://openrouter.ai/collections/free-models/), [router gratuito](https://openrouter.ai/openrouter/free)). No introduzcas información privada en consultas remotas. Ollama local sigue siendo el valor predeterminado y funciona sin cuenta ni API key.

Para usarlo, edita solo tu `.env` local (no compartas la clave ni la pegues en n8n):

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=pega_aqui_tu_clave_local
OPENROUTER_CHAT_MODEL=openrouter/free
```

Guarda el archivo y ejecuta `docker compose up -d backend` para que Compose actualice el entorno del contenedor. Para volver al proveedor local, cambia `AI_PROVIDER=ollama`; `bge-m3` sigue siendo necesario en ambos casos, mientras que `qwen2.5:3b` solo se necesita para generación local. Primero actualiza el nodo de n8n siguiendo la guía vinculada abajo.

### Instalación desde cero en Linux

Requisitos: Git, Docker Engine con el complemento Docker Compose v2, `curl`, RAM y almacenamiento suficientes para Docker y ambos modelos. El tiempo de respuesta de Ollama depende del hardware disponible. Los comandos siguientes usan Bash desde la raíz del repositorio.

```bash
cp .env.example .env
chmod 600 .env
```

Edita `.env` con los secretos locales requeridos arriba. Para una instalación nueva, reemplaza todos los `CHANGE_ME` y conserva la contraseña de PostgreSQL URL-safe. No compartas ni hagas commit de `.env`.

Instala Ollama según sus [instrucciones oficiales para Linux](https://ollama.com/download/linux), descarga los modelos y configura el servicio para que los contenedores puedan alcanzarlo en el host:

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl edit ollama
```

En el editor de `systemctl edit`, agrega:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Después:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
ollama pull bge-m3
ollama pull qwen2.5:3b
curl http://127.0.0.1:11434/api/tags
```

Compose mapea `host.docker.internal` al host mediante `host-gateway` para backend y n8n. La API de Ollama se expone en la red local del host; no abras el puerto 11434 a Internet ni a redes públicas. Comprueba también la respuesta desde n8n después del arranque. Si `systemctl` no está disponible en la distribución, configura el servicio Ollama equivalente para escuchar en `0.0.0.0:11434` antes de iniciar Compose.

Arranca y comprueba servicios:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps
curl --fail http://localhost:${APP_PORT:-3000}/health/ready
curl --fail http://localhost:6333/readyz
curl --fail http://localhost:5678/healthz
docker compose exec n8n node -e "fetch('http://host.docker.internal:11434/api/tags').then(async r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(e=>{console.error(e.message);process.exit(1)})"
```

Aplica, en orden, los once seeds listados abajo con `docker compose exec -T postgres psql -U rutaia_user -d rutaia -v ON_ERROR_STOP=1 < database/seeds/001_intecap_programacion_plc.sql` y repite con los archivos 002–011. El usuario predeterminado es `rutaia_user`; si se personalizó `POSTGRES_USER`, úsalo en `psql`. En una instalación n8n nueva, importa los dos JSON de `automation/n8n/` y crea/asigna las tres credenciales descritas en `automation/n8n/README.md`. Luego abre `RutaIA - Indexar cursos activos` y pulsa **Execute Workflow** una vez; es una ejecución manual de indexación, no actives el workflow. Confirma que los UUID de cursos activos coincidan con Qdrant. Configura y activa el workflow de consulta para hacer recomendaciones. Abre `http://localhost:${APP_PORT:-3000}`.

Para detener y reanudar en Linux:

```bash
docker compose stop       # conserva contenedores y volúmenes
docker compose start
docker compose down       # elimina contenedores/red, conserva datos
```

No uses `docker compose down -v` para la presentación: borra los datos persistentes de PostgreSQL, Qdrant y n8n. Compose y la resolución `host-gateway` están configurados para Linux, pero en esta sesión solo se verificó el motor Linux de Docker Desktop en Windows; aún falta ejecutar el instructivo en un host Linux real.

El flujo RAG usa Ollama local por defecto. Con `AI_PROVIDER=openrouter`, n8n manda la generación al endpoint interno autenticado de Express, que aplica la opción de proveedor y añade la clave desde el entorno del backend; n8n no recibe la clave. La indexación y las embeddings de consulta siguen usando Ollama. Revisa [automation/n8n/README.md](automation/n8n/README.md) para importar el workflow actualizado.

En Windows, antes de iniciar Compose, inicia Ollama Desktop o ejecuta `ollama serve` si el servidor no está activo. Descarga `bge-m3` y, si usarás generación local, `qwen2.5:3b`.

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

Los once seeds son idempotentes. Los seeds 001–008 cargan 29 ofertas; los seeds 009, 010 y 011 agregan tres, tres y dos respectivamente, para 37 cursos mantenidos por seed. El seed 011 añade [Lenguaje de programación Java (E-learning)](https://cursos.intecap.edu.gt/detalle/45278/2026) y [Power BI básico](https://cursos.intecap.edu.gt/detalle/43108/2026). Sus 40 y 20 horas se calculan desde el calendario y horario oficiales; las fichas no publican una carga curricular total. La descripción etiqueta explícitamente esas cifras como horas programadas, no curriculares. Los seeds 009–011 identifican del mismo modo las horas calculadas y no descuentan pausas no especificadas. Los enlaces oficiales de IA son 46350, 46366 y 47794; el seed 010 añade [Power BI intermedio](https://cursos.intecap.edu.gt/detalle/45525/2026), [FortiGate Administrator](https://cursos.intecap.edu.gt/detalle/45419/2026) y [Fundamentos de ciberseguridad, nube y firewalls](https://cursos.intecap.edu.gt/detalle/40370/2026). Los seeds 006–008 suman nueve ofertas TIC/automatización con horas respaldadas en páginas y publicaciones oficiales. El seed 008 agrega Automatización Industrial (360 h) e Instrumentista Industrial (540 h de formación más 300 h de práctica separada), según la [especialidad industrial de INTECAP Baja Verapaz](https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/). Después de aplicar un seed, ejecuta el workflow de indexación de n8n y confirma que el conteo de Qdrant coincide con los cursos activos. Las tarjetas de catálogo y las fuentes RAG enlazan a la fuente institucional. `level` es la clasificación pedagógica de RutaIA según objetivos/requisitos, no un CTO/CTM/CTMS; `intecap_career_type` queda NULL si la ficha no publica esa clasificación. Algunas fichas publican horas de práctica por separado; `duration_hours` conserva las horas de formación y la práctica separada se explica en la descripción. Si cambiaste `POSTGRES_USER` o el nombre de base, ajusta `-U`/`-d`. RAG requiere además Qdrant, modelos Ollama, workflows sincronizados y calibración del umbral.

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
- Qdrant debe tener la colección `rutaia_courses` (o la indicada por `QDRANT_COLLECTION`) tras indexar cursos. `GET http://localhost:6333/collections` permite inspeccionarla.
- n8n presenta su interfaz en `http://localhost:5678`. Al instalar el workflow actualizado, asigna la credencial de sincronización también al nodo `Generar respuesta grounded`; solo el nodo de embeddings llama Ollama directamente. La versión activa que ya está instalada no cambia al editar archivos locales: para usar el selector de proveedor, actualiza ese nodo en n8n según [la guía](automation/n8n/README.md). La versión actual conserva Ollama como predeterminado.
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

La suite `npm test` incluye HTTP local y pruebas aisladas de lógica de Code nodes y cliente n8n, sin depender de PostgreSQL; la integración de DB aparece omitida en esa suite. La validación OpenAPI parsea YAML, coteja operaciones con routers/montajes de `src/app.js`, resuelve referencias locales y exige esquemas para cada respuesta exitosa 200/201/202. `npm run validate:workflows` revisa JSON, nombres/IDs, conexiones y sintaxis de Code nodes en ambos workflows. `npm audit` incluye herramientas de desarrollo. Actualmente reporta 0 vulnerabilidades; se quitó `nodemon` y el script dev usa el watcher nativo de Node 22. Las pruebas RAG usan fixtures/contexto simulado y no sustituyen ejecutar los workflows en n8n con Qdrant y proveedor reales.

`npm run calibrate:rag` consulta el catálogo público local y embeddings Ollama (sin escribir en Qdrant ni enviar datos a proveedores externos). Última ejecución tras seed 011 (4 nov): BGE-M3 (1024 dimensiones), 38 cursos y 22 casos; tercer score máximo OOD `0.5292`, tercer score positivo mínimo `0.5396`; se conserva `0.535`. Las cifras anteriores `0.4569–0.5740` quedaron supersedidas por esta ejecución; no hay un snapshot del catálogo/modelo de la medición anterior que permita explicar la diferencia con certeza. En las siete consultas académicas: páginas web 1 fuente sobre el umbral; Java/Spring 1 (la oferta Java nueva puntúa `0.5302`, por debajo); dashboards 2; automatización empresarial 1 (Automatización Industrial, pertinente a procesos industriales y no equivalente a automatización administrativa); IA 3; seguridad de aplicaciones 3 (dos cursos Fortinet y Administrador de ciberseguridad; esto no demuestra cobertura específica de seguridad web); contenedores 0. IA y ciberseguridad general alcanzan tres fuentes; las demás áreas indicadas siguen con insuficiencia de fuentes y deben responder sin recomendaciones cuando no cumplen el mínimo.

La integración contra PostgreSQL real utiliza exclusivamente una base local llamada `rutaia_test`. Levanta Compose y configura en `.env` `RUTAIA_TEST_DATABASE_URL`, usando el usuario/contraseña local y la ruta `/rutaia_test`. Crea la base una sola vez si aún no existe:

El formato esperado es `postgresql://rutaia_user:<contraseña-url-safe>@localhost:5432/rutaia_test`; reemplaza el usuario/contraseña por los de tu `.env` sin pegar el valor en Git.

```powershell
docker exec rutaia-postgres-1 createdb -U rutaia_user rutaia_test
```

Luego, desde `backend/`:

```powershell
npm run test:integration
```

El runner rechaza otros hosts o nombres de base y la prueba elimina sus fixtures. No apuntes esa variable a una base con datos reales. La integración valida API/DB y callbacks sintéticos, no ejecuta los workflows n8n ni llama a Ollama.

Para desarrollar Express fuera de Docker: configura `DATABASE_URL` en `.env`, instala dependencias con `npm ci` desde `backend/` y ejecuta `npm run dev`. Para aplicar una migración manual contra la base local configurada: `npm run db:migrate`.

## API y código

La especificación está en [docs/api/openapi.yaml](docs/api/openapi.yaml); su verificador es `cd backend; npm run validate:openapi`. Rutas principales:

- Auth y sesión: `/api/v1/auth/*`.
- Perfil e historial: `/api/v1/students/*`, `/api/v1/queries/*`.
- Catálogo público/admin: `/api/v1/courses`, `/api/v1/admin/courses`.
- Calificaciones y métricas: `/api/v1/recommendations/{id}/rating`, `/api/v1/admin/statistics`.
- Callback/sincronización internos: `/api/v1/internal/*`.

El navegador habla solo con Express. Las mutaciones de sesión necesitan cookie HttpOnly y header `X-CSRF-Token`. Para conceder rol admin a una cuenta previamente registrada: `npm run admin:promote -- admin@example.com` desde `backend/`; el comando no crea contraseñas ni cuentas.

## Estado comprobado en este entorno — 4 de noviembre de 2026

**Actualización de esta continuación:** se aplicaron los seeds 009–011. El catálogo curado por seeds suma 37 cursos; la base local tiene 38 activos y Qdrant 38 puntos, con cero UUID faltantes y cero huérfanos. El indexador se ejecutó manualmente en CLI con broker 5680, sin activar el workflow. La recalibración BGE-M3 cubre 38 cursos/22 casos, conserva `.535` con ventana `0.5292–0.5396` y obtiene 1,1,2,1,3,3,0 para páginas web, Java/Spring, dashboards, automatización empresarial, IA, ciberseguridad y contenedores. Java/E-learning puntúa 0.5302 para Java/Spring y queda bajo el umbral; Power BI básico no eleva dashboards de 2/3. Ciberseguridad general llega a 3/3, pero no demuestra formación específica en seguridad web. No se ejecutó una nueva consulta persistida; la calibración solo compara embeddings. El workflow de indexación permanece manual/inactivo, con autorización docente confirmada. Los cuatro contenedores son Linux sobre Docker Desktop en Windows, no un host Linux nativo.

**Actualización de proveedor y estabilidad:** se agregó `AI_PROVIDER=ollama|openrouter`, proxy interno autenticado, restricción de modelos remotos a `openrouter/free` o sufijo `:free`, y se documentó cómo actualizar el nodo de generación ya guardado en n8n. El backend se reconstruyó y `/health/ready` respondió `ready`. `npm test` pasó 33 pruebas, ninguna falló y una integración optativa se omitió; OpenAPI pasó con 26 paths/29 operaciones/100 refs; workflows pasó con 28 nodos/33 conexiones/9 Code nodes; Compose validó. El proxy local produjo JSON real correcto con Ollama al limitar a 64 tokens; una generación de 192 tokens excedió 120 segundos. OpenRouter no se probó con una API key real, y el workflow n8n activo aún requiere actualizar manualmente su nodo. Esto tampoco es una prueba de host Linux nativo.

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
