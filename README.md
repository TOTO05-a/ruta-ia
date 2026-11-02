# RutaIA

RutaIA es una aplicación web de orientación académica que recomienda cursos del catálogo institucional mediante recuperación aumentada por generación (RAG).

## Requisitos y tecnologías

- Node.js 22 o posterior y npm.
- Docker Desktop para PostgreSQL, Qdrant, n8n y el backend (Compose verificado en el entorno local).
- Cuenta y clave API de OpenRouter para embeddings y generación.
- Frontend HTML, CSS y JavaScript; API Node.js/Express; PostgreSQL; Qdrant; n8n.

El profesor autorizó Express como excepción a Java/Spring Boot. Los demás requisitos del enunciado y la rúbrica se conservan.

## Estado real

- Implementados en código: base modular Express, salud/readiness, CORS/Helmet, manejo de errores, migración inicial, registro/inicio/cierre de sesión, sesión HttpOnly, validación CSRF, perfil, listados de estudiantes para administración, CRUD/catálogo de cursos, consultas, historial, calificaciones, estadísticas y frontend conectado.
- Pruebas ejecutadas: 12/12 pruebas unitarias/HTTP pasan; sintaxis verificada para 44 archivos JavaScript.
- Entorno integrado local: PostgreSQL, Qdrant, n8n y Express están `healthy`; la API informa PostgreSQL listo. Migración aplicada en PostgreSQL limpio y ocho tablas públicas verificadas.
- Prueba PostgreSQL/API ejecutada: registro devuelve HTTP 201 y `/auth/me` valida sesión con cookie; se eliminó la cuenta sintética al terminar.
- Prueba CRUD con cuenta admin y cursos sintéticos: crear, editar, filtrar categoría/nivel, paginar, desactivar/reactivar, confirmar ocultamiento público y lectura admin del inactivo; todos los registros de prueba se eliminaron.
- Pruebas de seguridad con una cuenta estudiante temporal: sin CSRF, POST responde 403; estudiante en ruta admin responde 403; consulta vacía responde 400. La cuenta se eliminó.
- Flujo de autenticación/perfil con PostgreSQL: alta 201, correo duplicado 409, login 200/contraseña incorrecta 401, PATCH permitido, campo extra rechazado (400), logout 204 y sesión revocada (401); la cuenta temporal se eliminó.
- Cookie verificada con `HttpOnly`, `SameSite=Lax` y `Max-Age`; al vencer una sesión en PostgreSQL, `/auth/me` devuelve 401 `SESSION_EXPIRED`.
- Prueba de consultas con dos estudiantes: una pregunta quedó en `Error` seguro por configuración de proveedor ausente; propietario pudo leerla y el otro estudiante recibió 404 para consulta e historial ajenos. Se eliminaron primero consultas y luego ambas cuentas.
- Callback integrado probado con payloads sintéticos: `Sin resultados` idempotente (202 y repetición 200) y `Respondida` con tres cursos activos (fuentes persistidas); rating devuelve 201 y una segunda calificación devuelve 409. Todos los datos temporales se eliminaron. Esto valida API/DB, no la ejecución del workflow ni el RAG de OpenRouter.
- Estadísticas contrastadas con los valores esperados de una query respondida, tres fuentes y una calificación sintéticas: total/contestadas/sin resultados/promedio de rating/curso recomendado coincidieron; todos los registros temporales se eliminaron.
- Tarjetas de cursos e historial operables por teclado (Enter/Espacio), con foco visible definido en CSS; revisión visual completa en navegador pendiente.
- Workflows JSON de indexación y consulta implementados, validados estáticamente e importados a n8n 2.46.4; ambos están inactivos. Qdrant responde, pero no tiene colección porque faltan modelos y catálogo autorizados.
- Pendiente: OpenRouter/modelos/credencial y revisión de retención, ejecución RAG completa, umbral calibrado, catálogo institucional, revisión visual en navegador.
- Pendiente: cargar al menos 20 cursos una vez recibida la fuente institucional autorizada. No se agregan cursos ficticios.
- GitHub: `main`, `dev` y `trabajo` están publicadas; el desarrollo continúa en `trabajo` (último commit `3269986`). `dev` y `main` esperan revisión e integración.

El detalle de requisitos, rúbrica, límites y bloqueos está en [diagnóstico inicial](docs/architecture/initial-diagnosis.md).

## Preparar y ejecutar el entorno con Docker Compose

```powershell
Copy-Item .env.example .env
```

Antes de iniciar, sustituye todos los valores `CHANGE_ME` de `.env` por secretos aleatorios y configura credenciales/modelos de OpenRouter. El ejemplo no contiene claves reales. No compartas ni subas `.env`.

```powershell
docker compose up --build
```

El Compose publica PostgreSQL, Qdrant, n8n y la aplicación solo en `127.0.0.1`, persiste datos en volúmenes y aplica la migración PostgreSQL antes de iniciar la API. En esta PC la aplicación está publicada en `http://localhost:3001` porque el puerto 3000 aparecía ocupado; una instalación limpia usa 3000 por defecto. Los workflows importados siguen inactivos y requieren credenciales/modelos antes de su prueba; el servicio levantado por Compose no implica que el flujo RAG esté listo.

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

Abre `http://localhost:3000` para usar el frontend estático servido por Express (en el Compose activo de esta PC: `http://localhost:3001`).

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
