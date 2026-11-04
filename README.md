# RutaIA

RutaIA es una aplicación web de orientación académica que busca cursos en un catálogo institucional y, cuando las integraciones están configuradas, genera recomendaciones RAG con fuentes verificables.

El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Se conservan los demás requisitos académicos y de la rúbrica.

**Modalidad:** desarrollo individual realizado por el estudiante autor del proyecto. La redacción grupal del enunciado no implica integrantes adicionales. Las operaciones académicas de catálogo, consultas, recomendaciones, fuentes e historial deben leer y escribir datos reales en PostgreSQL/Qdrant; fixtures sintéticos se limitan a pruebas aisladas y no se presentan como catálogo institucional.

## Requisitos

- Windows 10/11, PowerShell y Docker Desktop con motor Linux.
- Git para clonar el repositorio.
- Para desarrollo del backend fuera de Docker: Node.js 22+ y npm.
- Catálogo institucional elegido: INTECAP. La [programación oficial de cursos](https://intecap.edu.gt/informacion-de-cursos/) enlaza el [listado y fichas de oferta](https://cursos.intecap.edu.gt/). Hay 29 registros curados con fichas oficiales en `database/seeds/001`–`008`; la comprobación actual confirmó sus 29 UUID en Qdrant. El nivel didáctico `level` de RutaIA (Básico/Intermedio/Avanzado) y la clasificación oficial de carrera `intecapCareerType` (CTO/CTM/CTMS) se almacenan por separado; no se convierten entre sí. No asignar niveles ni horas faltantes sin respaldo oficial.
- Ollama instalado localmente con los modelos `bge-m3` y `qwen2.5:3b` descargados, cuando se vaya a habilitar RAG. El modelo de embeddings debe usarse tanto para indexar como para consultar.

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
- `OLLAMA_EMBEDDING_MODEL` y `OLLAMA_CHAT_MODEL`: por defecto `bge-m3` y `qwen2.5:3b`. Descárgalos en Ollama con `ollama pull bge-m3` y `ollama pull qwen2.5:3b`.
- `RAG_MIN_SIMILARITY`: entorno local `0.535`. La calibración BGE-M3 cubre 21 consultas y mide los cursos con el mismo texto que usa n8n para indexarlos. La ventana observada es `0.5292–0.5396`; se conserva `0.535`. Las siete preguntas académicas obligatorias se prueban con el calibrador y sus puntajes también se contrastaron contra Qdrant. Consulta `docs/testing/acceptance-test-matrix.md`; recalibra al cambiar catálogo o modelo.

El flujo RAG usa Ollama local y no requiere una clave ni credenciales externas de modelos. El endpoint Ollama debe ser accesible desde los contenedores de Compose; revisa [automation/n8n/README.md](automation/n8n/README.md) para configurar y comprobarlo.

Antes de iniciar Compose, inicia Ollama Desktop o abre otra PowerShell y ejecuta `ollama serve` si el servidor no está activo. Descarga los modelos una vez con `ollama pull bge-m3` y `ollama pull qwen2.5:3b`.

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
```

Los ocho seeds son idempotentes: cargan 29 ofertas INTECAP y asocian fichas oficiales a `courses.source_url`. Los seeds 006–008 suman nueve ofertas TIC/automatización con horas respaldadas en páginas y publicaciones oficiales. El seed 008 agrega Automatización Industrial (360 h) e Instrumentista Industrial (540 h de formación más 300 h de práctica separada), según la [especialidad industrial de INTECAP Baja Verapaz](https://www.intecap.edu.gt/centros/centrobajaverapaz/industrial/). Después de aplicar un seed, ejecuta el workflow de indexación de n8n y confirma que el conteo de Qdrant coincide con los cursos activos. Las tarjetas de catálogo y las fuentes RAG enlazan a la fuente institucional. `level` es la clasificación pedagógica de RutaIA según objetivos/requisitos, no un CTO/CTM/CTMS; `intecap_career_type` queda NULL si la ficha no publica esa clasificación. Algunas fichas publican horas de práctica por separado; `duration_hours` conserva las horas de formación y la práctica separada se explica en la descripción. Si cambiaste `POSTGRES_USER` o el nombre de base, ajusta `-U`/`-d`. RAG requiere además Qdrant, modelos Ollama, workflows sincronizados y calibración del umbral.

`courses.intecap_career_type` conserva por separado CTO/CTM/CTMS, si la ficha identifica una carrera de esa clasificación. En ofertas modulares como PLC queda `NULL`; `courses.level` continúa expresando dificultad didáctica de RutaIA.

Comprueba la API y las dependencias:

```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/health/ready
Invoke-RestMethod http://localhost:3001/api/v1/courses?limit=100&page=1
Invoke-RestMethod http://localhost:6333/readyz
```

En una instalación que use el puerto predeterminado, reemplaza `3001` por `3000`. `/health/ready` verifica la conexión PostgreSQL. `docker compose ps` debe mostrar los cuatro servicios de RutaIA como `healthy`. No uses `docker compose down -v`: borraría los volúmenes persistentes.

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
- n8n presenta su interfaz en `http://localhost:5678`. Los workflows ya están importados: no los reimportes mientras asignas credenciales. Asigna las credenciales internas como indica [la guía n8n](automation/n8n/README.md); configura los dos nodos Ollama con **Authentication: None**. Ejecuta primero la indexación manual y verifica el índice antes de activar consulta RAG.
- `docker compose ps` saludable y una respuesta sintética de callback **no** prueban el RAG completo. Consulta configuración y pruebas de los workflows en [automation/n8n/README.md](automation/n8n/README.md).

## Pruebas y validaciones

Desde `backend/`:

```powershell
npm ci
npm test
npm run test:integration
npm run validate:openapi
npm run validate:workflows
npm run calibrate:rag
```

La suite `npm test` incluye HTTP local y pruebas aisladas de lógica de Code nodes y cliente n8n, sin depender de PostgreSQL; la integración de DB aparece omitida en esa suite. La validación OpenAPI parsea YAML, coteja operaciones con routers/montajes de `src/app.js`, resuelve referencias locales y exige esquemas para cada respuesta exitosa 200/201/202. `npm run validate:workflows` revisa JSON, nombres/IDs, conexiones y sintaxis de Code nodes en ambos workflows. Las pruebas RAG usan fixtures/contexto simulado y no sustituyen ejecutar los workflows en n8n con Qdrant y proveedor reales.

`npm run calibrate:rag` consulta el catálogo público local y embeddings Ollama (sin escribir en Qdrant ni enviar datos a proveedores externos). Con BGE-M3 (1024 dimensiones), la calibración del catálogo de 29 cursos confirmó 21 casos etiquetados, tercer score máximo OOD `0.5292` y tercer score positivo mínimo `0.5396`; se conserva `0.535`. Páginas web obtiene 1 fuente sobre el umbral; Java/Spring 1; dashboards 2; automatización empresarial 1 (Automatización Industrial, pertinente a procesos industriales y no equivalente a automatización administrativa); IA 0; seguridad web 1; contenedores 0. Ninguna de las siete preguntas obtiene las tres fuentes que exige el flujo.

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

## Estado comprobado en este entorno — 3 de noviembre de 2026

- `docker compose --env-file .env config --quiet` y `docker compose up --build -d` pasaron. Los cuatro servicios quedaron `healthy`. Desde los contenedores se comprobaron respuestas HTTP 200 backend→n8n, backend→Qdrant, n8n→backend y n8n→Qdrant; PostgreSQL está listo para la API.
- 3 nov: tras migrar RAG a Ollama, `docker compose up --build -d` reconstruyó solo backend y los cuatro servicios quedaron saludables. `n8n` recibió HTTP 200 en `host.docker.internal:11434/api/tags`; se instalaron localmente `bge-m3` y `qwen2.5:3b`.
- 3 nov: se actualizaron por sus IDs existentes los dos workflows n8n (14 nodos cada uno); en aquella revisión ambos seguían inactivos y no había duplicados. Una prueba temporal leyó 20 cursos, creó embeddings BGE‑M3 de 1024 dimensiones, indexó/buscó en Qdrant, recibió cinco fuentes y obtuvo respuesta JSON válida de Qwen; borró la colección temporal. Después se activó el workflow de consulta para una prueba local; el de indexación sigue inactivo.
- Verificación previa a seed 008 (3 nov): `npm test` 26 aprobadas, 0 fallidas y 1 integración optativa omitida; `npm run test:integration` 1 aprobada contra `rutaia_test`, con seeds 001–007; OpenAPI validó 25 paths/28 operaciones/95 refs; workflows validó 28 nodos, 33 conexiones y 9 Code nodes.
- Verificación anterior al seed 008: `npm test` 26 aprobadas, 0 fallidas y 1 integración optativa omitida; `npm run test:integration` 1 aprobada contra `rutaia_test`; OpenAPI validó 25 paths/28 operaciones/95 refs; workflows validó 28 nodos, 33 conexiones y 9 Code nodes.
- Catálogo previo: 27 cursos INTECAP. El seed 008 añade Automatización Industrial (360 h) e Instrumentista Industrial (540 h formación + 300 h práctica) con fuente oficial; PostgreSQL ya aplicó el seed y la API ofrece 29 cursos. La integración prueba el seed 008, sus duraciones, URLs, detalles e idempotencia.
- **Sincronización actual verificada:** el workflow de indexación se ejecutó desde n8n. PostgreSQL tiene 29 cursos activos y Qdrant `rutaia_courses` tiene 29 puntos únicos; se compararon todos los UUID y no hay cursos activos sin vector ni puntos huérfanos. El indexador permanece inactivo después de la ejecución manual; el workflow de consulta sigue activo.
- La nueva calibración BGE-M3 (21 casos, 29 cursos, umbral `0.535`) da cobertura obligatoria: páginas web 1; Java/Spring 1; dashboards 2; automatización empresarial 1; IA 0; seguridad web 1; contenedores 0. La fuente añadida de automatización es industrial y no satisface por sí sola la consulta empresarial. Ninguna pregunta alcanza tres fuentes relevantes.
- **E2E actual posterior al seed 008 y al ajuste RAG:** registro (201), login (200), catálogo (29), consulta (202) y resultado `Respondida` en 65 s con las tres fuentes INTECAP mejor clasificadas; historial (200), calificación (201), pregunta vacía rechazada y estudiante inexistente (404). La cuenta, sesión, consulta, recomendación, fuentes y rating temporales se limpiaron. Cocina italiana había terminado `Sin resultados` en una E2E previa.
- **Corrección de timeout RAG:** el workflow local generó hasta 768 tokens y la llamada al modelo agotó el límite HTTP de 300 s. Se acotó la salida a 192 tokens y a tres campos breves. La misma consulta E2E ahora termina en 65 s. Una prueba aislada de Qwen generó JSON válido con 49 tokens en 21 s. El filtro pasa al modelo solo las tres fuentes activas mejor clasificadas.
- **Cobertura restante:** la calibración con 29 cursos no llega a tres fuentes relevantes para varias consultas académicas. INTECAP publica [Inteligencia Artificial y Ciencia de Datos](https://cursos.intecap.edu.gt/detalle/45808/2026) asincrónico sin total de horas y [Herramientas de IA para la productividad](https://cursos.intecap.edu.gt/detalle/4362/2027) con duración de tres meses, pero sin total de horas; el modelo actual exige `duration_hours`, así que no se asignaron horas estimadas. Tampoco se verificó una ficha INTECAP de Docker/Kubernetes con horas. No reemplazar estos datos faltantes con cursos inventados ni equiparar automáticamente cloud/Linux a contenedores.
- **Validación final de código:** `npm test` 26 aprobadas, 0 fallidas y 1 prueba de integración optativa omitida; `npm run test:integration` 1/1; `npm run validate:openapi` 25 paths/28 operaciones/95 refs; `npm run validate:workflows` 28 nodos/33 conexiones/9 Code nodes; `git diff --check` sin errores.
- El indexador n8n también se ejecutó con un curso institucional temporalmente inactivo: Qdrant pasó de 20 a 19 puntos y retiró ese vector; tras reactivar el curso y repetir el flujo volvió a 20 puntos y recuperó el UUID. Se verificó que el curso quedó activo.
- El flujo Git local usa `trabajo` (desarrollo), `dev` (integración) y `main` (estable). Revisa `git status` antes de continuar.

## Continuidad

Lee [docs/MANUAL_PROYECTO.md](docs/MANUAL_PROYECTO.md) para el mapa de servicios, variables, pruebas, estado por flujo y orden recomendado para retomar.

La presentación académica editable está en [docs/entrega/RutaIA_presentacion_final.pptx](docs/entrega/RutaIA_presentacion_final.pptx). Resume la arquitectura y las evidencias disponibles, incluye la cobertura real de la rúbrica y propone un guion de sustentación de 10–15 minutos.
