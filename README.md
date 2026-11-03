# RutaIA

RutaIA es una aplicación web de orientación académica que busca cursos en un catálogo institucional y, cuando las integraciones están configuradas, genera recomendaciones RAG con fuentes verificables.

El profesor autorizó usar Node.js/Express en lugar de Java/Spring Boot. Se conservan los demás requisitos académicos y de la rúbrica.

**Modalidad:** desarrollo individual realizado por el estudiante autor del proyecto. La redacción grupal del enunciado no implica integrantes adicionales. Las operaciones académicas de catálogo, consultas, recomendaciones, fuentes e historial deben leer y escribir datos reales en PostgreSQL/Qdrant; fixtures sintéticos se limitan a pruebas aisladas y no se presentan como catálogo institucional.

## Requisitos

- Windows 10/11, PowerShell y Docker Desktop con motor Linux.
- Git para clonar el repositorio.
- Para desarrollo del backend fuera de Docker: Node.js 22+ y npm.
- Catálogo institucional elegido: INTECAP. La [programación oficial de cursos](https://intecap.edu.gt/informacion-de-cursos/) enlaza el [listado y fichas de oferta](https://cursos.intecap.edu.gt/). Los 20 registros curados con fichas oficiales están en `database/seeds/001`–`004`; se verificaron en PostgreSQL y mediante búsqueda/detalle API. El nivel didáctico `level` de RutaIA (Básico/Intermedio/Avanzado) y la clasificación oficial de carrera `intecapCareerType` (CTO/CTM/CTMS) se almacenan por separado; no se convierten entre sí. No asignar niveles ni horas faltantes sin respaldo oficial.
- Una cuenta propietaria local de n8n y una clave de OpenRouter, con endpoints elegibles para la política ZDR, cuando se vaya a habilitar RAG.

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
- `OPENROUTER_EMBEDDING_MODEL` y `OPENROUTER_CHAT_MODEL`: modelos base del ejemplo. Verifica modelos y endpoints actuales antes de utilizarlos.
- `RAG_MIN_SIMILARITY`: déjalo vacío hasta calibrarlo con el catálogo y casos etiquetados.

La clave de OpenRouter **no** se configura en el backend ni en `.env`: se guarda como credencial cifrada Header Auth dentro de n8n. Los nombres de headers y los valores esperados están en [automation/n8n/README.md](automation/n8n/README.md). No envíes preguntas reales de estudiantes a un proveedor externo sin aprobación institucional de privacidad.

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
```

Los cuatro seeds son idempotentes y cargan 20 ofertas INTECAP 2027 con duración y objetivo documentados. Las URLs fuente, horas y requisitos figuran en los comentarios de cada seed. `level` es la clasificación pedagógica de RutaIA según objetivos/requisitos, no un CTO/CTM/CTMS; `intecap_career_type` queda NULL si la ficha no publica esa clasificación. Algunas fichas publican horas de práctica por separado; `duration_hours` conserva las horas de formación y la práctica separada se explica en la descripción. Si cambiaste `POSTGRES_USER` o el nombre de base, ajusta `-U`/`-d`. Completar el mínimo de cursos no implica que RAG esté listo: faltan colección Qdrant, modelos y credenciales.

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
- n8n presenta su interfaz en `http://localhost:5678`. Crea la cuenta propietaria desde la interfaz, importa los dos JSON de `automation/n8n/`, asigna credenciales y ejecuta primero la indexación manual con cursos autorizados. No actives la consulta RAG hasta tener al menos tres cursos válidos, índice verificado y credenciales probadas.
- `docker compose ps` saludable y una respuesta sintética de callback **no** prueban el RAG completo. Consulta pasos de credenciales, privacidad y flujos en [automation/n8n/README.md](automation/n8n/README.md).

## Pruebas y validaciones

Desde `backend/`:

```powershell
npm ci
npm test
npm run validate:openapi
npm run validate:workflows
```

La suite `npm test` incluye HTTP local y pruebas aisladas de lógica de Code nodes y cliente n8n, sin depender de PostgreSQL; la integración de DB aparece omitida en esa suite. La validación OpenAPI parsea YAML, coteja operaciones con routers/montajes de `src/app.js`, resuelve referencias locales y exige esquemas para cada respuesta exitosa 200/201/202. `npm run validate:workflows` revisa JSON, nombres/IDs, conexiones y sintaxis de Code nodes en ambos workflows. Las pruebas RAG usan fixtures/contexto simulado y no sustituyen ejecutar los workflows en n8n con Qdrant y proveedor reales.

La integración contra PostgreSQL real utiliza exclusivamente una base local llamada `rutaia_test`. Levanta Compose y configura en `.env` `RUTAIA_TEST_DATABASE_URL`, usando el usuario/contraseña local y la ruta `/rutaia_test`. Crea la base una sola vez si aún no existe:

El formato esperado es `postgresql://rutaia_user:<contraseña-url-safe>@localhost:5432/rutaia_test`; reemplaza el usuario/contraseña por los de tu `.env` sin pegar el valor en Git.

```powershell
docker exec rutaia-postgres-1 createdb -U rutaia_user rutaia_test
```

Luego, desde `backend/`:

```powershell
npm run test:integration
```

El runner rechaza otros hosts o nombres de base y la prueba elimina sus fixtures. No apuntes esa variable a una base con datos reales. La prueba valida API/DB y callbacks sintéticos, no llama OpenRouter ni ejecuta los workflows n8n.

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
- `npm test`: 22 aprobadas, 0 fallidas, 1 integración optativa omitida. `npm run test:integration`: 1 aprobada contra `rutaia_test`; valida auth, los 20 cursos por búsqueda/detalle e idempotencia, historial/aislamiento, 401 sin sesión y 404 para historial inexistente, callbacks y ratings. `npm run validate:openapi`: 25 paths, 28 operaciones coincidentes y 71 refs locales; requiere schemas para respuestas 200/201/202. `npm run validate:workflows`: 25 nodos, 30 conexiones y 8 Code nodes compilables.
- Catálogo actual: **20 cursos INTECAP** cargados desde cuatro seeds idempotentes; las 16 ofertas añadidas incluyen sistemas informáticos (300 h), administración SQL Server (720 h), electrónica automotriz (555 h), soporte eléctrico/refrigeración, formación gastronómica y confección. Las fichas, duraciones y fuentes están en [manual](docs/MANUAL_PROYECTO.md) y `database/seeds/`. `level` es taxonomía pedagógica RutaIA y `intecap_career_type` conserva aparte CTO/CTM/CTMS cuando una ficha lo indique. Qdrant: **0 colecciones**.
- Backend en Compose: modelos y umbral RAG están sin configurar. La API de gestión de workflows n8n responde `401 Unauthorized` sin sesión; sus copias importadas no se actualizaron ni probaron con credenciales.
- Por ello, registro/login, catálogo con 20 cursos oficiales, endpoints, persistencia y callback sintético están implementados/probados en sus alcances indicados; la generación y recomendación RAG real, sus fuentes y calificaciones del resultado real siguen sin verificarse. Se requiere acceso propietario n8n, clave/modelo OpenRouter ZDR aprobados, indexación y calibración.
- El flujo Git local usa `trabajo` (desarrollo), `dev` (integración) y `main` (estable). Revisa `git status` antes de continuar.

## Continuidad

Lee [docs/MANUAL_PROYECTO.md](docs/MANUAL_PROYECTO.md) para el mapa de servicios, variables, pruebas, estado por flujo y orden recomendado para retomar.
