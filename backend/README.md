# Backend – API de Productos (Ejercicio 1)

API REST con **NestJS 12** y **MongoDB** para gestionar productos: CRUD protegido con JWT, paginación y búsqueda, validación estricta, errores con formato único y documentación Swagger.

- Especificación: [docs/specs/01-backend.md](../docs/specs/01-backend.md)
- Contrato con el frontend: [docs/specs/api-contract.md](../docs/specs/api-contract.md)
- OpenAPI exportado: [docs/openapi.json](../docs/openapi.json)

## Requisitos

- Node.js LTS y npm
- MongoDB en local (Community Server, sin autenticación) o con Docker (`docker compose up -d` desde la raíz del repo)

## Instalación

```bash
cd backend
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Cambia `JWT_SECRET` en `.env` por un valor largo y aleatorio, por ejemplo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Variables de entorno

| Variable | Ejemplo | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `MONGO_URI` | `mongodb://localhost:27017/productos_db` | Conexión a MongoDB (sirve también una URI de Atlas) |
| `JWT_SECRET` | — | Clave para firmar los tokens. Nunca se sube al repo |
| `JWT_EXPIRES_IN` | `1h` | Vigencia del token: segundos (`3600`) o `30m`, `1h`, `1d` |
| `CORS_ORIGIN` | `http://localhost:5173` | Único origen permitido (el frontend) |

Todas son obligatorias. Si falta alguna o tiene un formato inválido, la app **no arranca** y dice cuál es:

```
Error: Invalid environment configuration (see backend/.env.example):
  - JWT_SECRET is required
```

## Ejecución

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Desarrollo con recarga automática |
| `npm run build` y luego `npm run start:prod` | Compila a `dist/` y ejecuta |
| `npm test` | Tests unitarios (`ProductsService`, `AuthService`) |
| `npm run test:e2e` | Tests end-to-end de los criterios de aceptación (necesita MongoDB; usa la base `productos_db_e2e` y la borra al terminar) |
| `npm run lint` | Lint con oxlint |
| `npm run docs:export` | Regenera `docs/openapi.json` (no necesita MongoDB) |

- API: `http://localhost:3000/api/v1`
- Swagger UI: **http://localhost:3000/api/docs**
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

## Probar desde Swagger

1. `POST /auth/register` con `{ "email": "ana@correo.com", "password": "Clave1234", "name": "Ana Pérez" }`.
2. `POST /auth/login` y copia el `accessToken`.
3. Pulsa **Authorize**, pega el token (sin escribir `Bearer`) y prueba los endpoints de `Products`. El token se conserva al recargar la página.

## Ejemplos con curl

```bash
# Registro
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@correo.com","password":"Clave1234","name":"Ana Pérez"}'

# Login → { accessToken, tokenType: "Bearer", expiresIn: 3600 }
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@correo.com","password":"Clave1234"}'

TOKEN=<accessToken>

# Crear producto
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50"}'

# Listar con búsqueda, orden y paginación
curl "http://localhost:3000/api/v1/products?page=1&limit=10&search=cafe&sortBy=price&order=asc" \
  -H "Authorization: Bearer $TOKEN"

# Actualizar parcialmente / eliminar
curl -X PATCH http://localhost:3000/api/v1/products/<id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"price":30000}'
curl -X DELETE http://localhost:3000/api/v1/products/<id> -H "Authorization: Bearer $TOKEN"
```

## Endpoints

| Método | Ruta | JWT | Éxito | Errores |
|---|---|---|---|---|
| POST | `/auth/register` | No | 201 usuario | 400, 409, 429 |
| POST | `/auth/login` | No | 200 token | 400, 401, 429 |
| GET | `/auth/me` | Sí | 200 usuario | 401 |
| GET | `/products` | Sí | 200 lista paginada | 400, 401 |
| GET | `/products/:id` | Sí | 200 producto | 400, 401, 404 |
| POST | `/products` | Sí | 201 producto | 400, 401, 409 |
| PATCH | `/products/:id` | Sí | 200 producto | 400, 401, 404, 409 |
| DELETE | `/products/:id` | Sí | 204 | 400, 401, 404 |

`GET /products` acepta `page` (1), `limit` (10, máx. 100), `search` (en el nombre, sin distinguir mayúsculas ni tildes: `cafe` encuentra "Café" y "CAFETERA"), `sortBy` (`name`, `price`, `stock`, `createdAt`) y `order` (`asc`, `desc`).

Todos los errores tienen la forma:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["price must not be less than 0"], "path": "/api/v1/products", "timestamp": "2026-11-17T21:30:00.000Z" }
```

## Seguridad

- Contraseñas con **bcrypt** (12 rondas). La contraseña nunca aparece en respuestas, logs ni esquemas de Swagger.
- Login con mensaje genérico (`Invalid credentials`) y tiempo de respuesta similar exista o no el email.
- **JWT** HS256 firmado con `JWT_SECRET`; si el usuario fue eliminado, su token deja de servir.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`: rechaza campos desconocidos y operadores de MongoDB como `{"$gt": ""}`. La búsqueda escapa el texto, así que no se puede inyectar una expresión regular.
- **Rate limiting**: 100 peticiones/min por IP en general y 5/min en `POST /auth/login` (429).
- **helmet** para headers seguros y **CORS** restringido a `CORS_ORIGIN`.
- En errores 500 solo se responde `Internal server error`; el detalle va al log del servidor.

## Estructura

```
src/
├── main.ts                 # arranque: configuración, Swagger, puerto
├── app.module.ts           # config, MongoDB, throttler y módulos
├── app.setup.ts            # prefijo, helmet, CORS, ValidationPipe, filtro (compartido con e2e)
├── config/                 # validación de entorno y Swagger
├── common/                 # filtro de errores, ParseObjectIdPipe, paginación, utilidades
├── auth/                   # registro, login, JWT strategy/guard, @CurrentUser
├── users/                  # schema y servicio de usuarios
├── products/               # schema, DTOs, servicio y controlador
└── scripts/export-openapi.ts
test/app.e2e-spec.ts        # criterios de aceptación de la spec §11
```

Los controladores solo reciben y responden, la lógica está en los servicios y el acceso a datos va por los modelos de Mongoose inyectados.

## Decisiones

- **Eliminación física**: `DELETE` borra el documento.
- **Registro abierto**: cualquiera puede registrarse, para facilitar la evaluación.
- **Lecturas protegidas**: también los `GET` de productos requieren JWT.
- En `PATCH`, enviar `null` borra `description` o `category`; para campos obligatorios devuelve 400.
- NestJS 12 es ESM-only y su CLI trae Vitest y oxlint, que se usan en lugar de Jest y ESLint.
