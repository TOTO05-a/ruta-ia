# RutaIA

RutaIA es una aplicación web de orientación académica que recomienda cursos del catálogo institucional mediante recuperación aumentada por generación (RAG).

## Requisitos y tecnologías

- Node.js 22 o posterior y npm.
- Docker Desktop para PostgreSQL, Qdrant, n8n y el backend (Compose definido, pendiente de ejecutar).
- Cuenta y clave API de OpenRouter para embeddings y generación.
- Frontend HTML, CSS y JavaScript; API Node.js/Express; PostgreSQL; Qdrant; n8n.

El profesor autorizó Express como excepción a Java/Spring Boot. Los demás requisitos del enunciado y la rúbrica se conservan.

## Estado real

- Implementados en código: base modular Express, salud/readiness, CORS/Helmet, manejo de errores, migración inicial, registro/inicio/cierre de sesión, sesión HttpOnly, validación CSRF, perfil, listados de estudiantes para administración, CRUD/catálogo de cursos, consultas, historial, calificaciones, estadísticas y frontend conectado.
- Pruebas ejecutadas: 12/12 unitarias y HTTP locales pasaron el 2 de noviembre de 2026; sintaxis verificada para 44 archivos JavaScript.
- Pendiente de ejecución: migración y endpoints dependientes de PostgreSQL. Docker no pudo conectarse a su daemon en este entorno.
- Workflows JSON de indexación y consulta implementados y validados estáticamente; importación/activación pendiente. PostgreSQL, Qdrant, n8n y OpenRouter siguen sin ejecución real verificada.
- Pendiente de ejecutar/verificar: Docker Compose, umbral RAG calibrado, datos institucionales y verificación visual de la interfaz en navegador.
- Pendiente: cargar al menos 20 cursos una vez recibida la fuente institucional autorizada. No se agregan cursos ficticios.
- GitHub: `main`, `dev` y `trabajo` están publicadas; `main` y `dev` siguen en el commit inicial, el desarrollo continúa en `trabajo`.

El detalle de requisitos, rúbrica, límites y bloqueos está en [diagnóstico inicial](docs/architecture/initial-diagnosis.md).

## Preparar y ejecutar el entorno con Docker Compose

```powershell
Copy-Item .env.example .env
```

Antes de iniciar, sustituye todos los valores `CHANGE_ME` de `.env` por secretos aleatorios y configura credenciales/modelos de OpenRouter. El ejemplo no contiene claves reales. No compartas ni subas `.env`.

```powershell
docker compose up --build
```

El Compose publica PostgreSQL, Qdrant, n8n y la aplicación solo en `127.0.0.1`, persiste datos en volúmenes y aplica la migración PostgreSQL antes de iniciar la API. Los nodos/credenciales de n8n aún deben importarse y configurarse; el servicio levantado por Compose no implica que el flujo RAG esté listo.

## Base de datos

Con Compose, la API aplica las migraciones al iniciar. Para aplicar manualmente contra PostgreSQL local, configura `DATABASE_URL` en `.env` y desde `backend/` ejecuta:

```powershell
npm run db:migrate
```

Para asignar administrador a una cuenta previamente registrada, desde `backend/`:

```powershell
npm run admin:promote -- admin@example.com
```

El comando no crea usuarios ni contraseñas; cambia únicamente el rol de una cuenta existente.

## Ejecutar

```powershell
cd backend
npm run dev
```

Abre `http://localhost:3000` para usar el frontend estático servido por Express.

- API liveness: `GET http://localhost:3000/health`
- PostgreSQL readiness: `GET http://localhost:3000/health/ready`
- OpenAPI: [docs/api/openapi.yaml](docs/api/openapi.yaml)

### Endpoints implementados

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `GET /api/v1/auth/csrf`
- `PATCH /api/v1/students/me`; `GET /api/v1/students` y `GET /api/v1/students/:id` (administración)
- `GET /api/v1/courses` y `GET /api/v1/courses/:id` (solo cursos activos)
- `GET/POST /api/v1/admin/courses`, `GET/PATCH /api/v1/admin/courses/:id`, `PATCH /api/v1/admin/courses/:id/status`
- `POST /api/v1/queries`, `GET /api/v1/queries`, `GET /api/v1/queries/:id`, `GET /api/v1/students/:id/history`
- `POST /api/v1/recommendations/:id/rating`, `GET /api/v1/admin/statistics`
- Callbacks/rutas internas autenticadas: `GET /api/v1/internal/courses/active`, `GET /api/v1/internal/rag/index-config`, `POST /api/v1/internal/n8n/results`

Las operaciones que cambian datos requieren el token CSRF devuelto al registrar/iniciar sesión o recuperado en `/auth/csrf`, enviado como `X-CSRF-Token`. La cookie de sesión es HttpOnly.

## Pruebas

```powershell
cd backend
npm test
```

Las pruebas existentes cubren validaciones de autenticación, cursos, perfil, consultas, callback y calificaciones; hash de contraseña; health HTTP; frontend estático; JSON malformado y 404. Todavía no prueban flujos con PostgreSQL ni integraciones externas.

## Arquitectura y datos

- [Diagrama de contexto](docs/architecture/system-context.md)
- [Modelo entidad-relación](docs/architecture/data-model.md)
- [Workflows y configuración de n8n](automation/n8n/README.md)
- [Matriz de aceptación y pruebas](docs/testing/acceptance-test-matrix.md)
- Migración: `database/migrations/001_initial_schema.sql`

Las recomendaciones deben citar cursos existentes y activos. Express coordinará PostgreSQL/n8n; el navegador no llamará directamente a n8n, Qdrant ni OpenRouter.
