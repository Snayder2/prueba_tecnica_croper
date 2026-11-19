# Backend – API de Productos (Ejercicio 1 + spec 03)

API REST con **NestJS 12** y **MongoDB** para un pequeño marketplace agro (contrato **1.1.0**). Los vendedores gestionan sus productos (stock, descuentos e imágenes) y los compradores consultan un catálogo con filtros. Incluye JWT con roles, validación estricta, errores con formato único y documentación Swagger.

- Especificaciones: [docs/specs/01-backend.md](../docs/specs/01-backend.md) (1.0) y [docs/specs/03-mejoras-roles-vendedor-comprador.md](../docs/specs/03-mejoras-roles-vendedor-comprador.md) (1.1.0)
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
| `PUBLIC_BASE_URL` | `http://localhost:3000` | Base de las URLs absolutas de las imágenes |

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
| `npm test` | Tests unitarios (servicios, guards, pipes, imágenes, precio final, DTOs) |
| `npm run test:e2e` | Tests end-to-end de los criterios de aceptación, incluidas la concurrencia del stock y la subida real de imágenes. Necesita MongoDB; usa la base `productos_db_e2e` y la borra al terminar |
| `npm run lint` | Lint con oxlint |
| `npm run docs:export` | Regenera `docs/openapi.json` (no necesita MongoDB) |
| `npm run seed` | Reinicia la base con datos de prueba (ver abajo) |

- API: `http://localhost:3000/api/v1`
- Swagger UI: **http://localhost:3000/api/docs**
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

## Base de datos y datos de prueba

La versión 1.1.0 (vendedores y compradores) **parte de una base vacía**: no hay migración desde la 1.0.0. Antes de usarla por primera vez, borra la base vieja o ejecuta el seed, que deja siempre el mismo estado:

```bash
mongosh productos_db --eval "db.dropDatabase()"   # opcional si tienes mongosh
npm run seed
```

`npm run seed` vacía las colecciones `users` y `products` (y recrea sus índices, así desaparece el índice único global de `sku` de la 1.0.0) y crea:

- 30 productos de `seed/products.json` repartidos entre los dos vendedores: 8 con descuento, 3 agotados y 3 ocultos. Las imágenes de `seed/images/` (propias) se procesan con el mismo servicio de la app.
- Estos usuarios, todos con la contraseña `Clave1234`:

| Rol | Email |
|---|---|
| Vendedor | `ana.vendedora@correo.com` |
| Vendedor | `bruno.vendedor@correo.com` |
| Comprador | `carla.compradora@correo.com` |

Se puede ejecutar varias veces sin duplicar nada.

## Probar desde Swagger

1. Usa un usuario del seed (por ejemplo `ana.vendedora@correo.com` / `Clave1234`) o regístrate con `POST /auth/register` y `"role": "seller"` o `"buyer"`.
2. `POST /auth/login` y copia el `accessToken`.
3. Pulsa **Authorize**, pega el token (sin escribir `Bearer`) y prueba los endpoints de `Catalog` y `Seller products`. La subida de imágenes muestra un selector de archivo. El token se conserva al recargar la página.

## Ejemplos con curl

```bash
# Registro (role: seller o buyer)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@correo.com","password":"Clave1234","name":"Ana Pérez","role":"seller"}'

# Login → { accessToken, tokenType: "Bearer", expiresIn: 3600 }
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@correo.com","password":"Clave1234"}'

TOKEN=<accessToken>

# Vendedor: crear, editar, ajustar stock, descuento e imagen
curl -X POST http://localhost:3000/api/v1/seller/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50"}'
curl -X PATCH http://localhost:3000/api/v1/seller/products/<id> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"price":140000}'
curl -X POST http://localhost:3000/api/v1/seller/products/<id>/stock-adjustments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"decrease","quantity":3}'
curl -X PUT http://localhost:3000/api/v1/seller/products/<id>/discount \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"percent":15}'
curl -X POST http://localhost:3000/api/v1/seller/products/<id>/images \
  -H "Authorization: Bearer $TOKEN" -F "image=@foto.jpg;type=image/jpeg"

# Catálogo (cualquier rol)
curl "http://localhost:3000/api/v1/products?category=Fertilizantes&onSale=true&maxPrice=150000&sortBy=finalPrice&order=asc" \
  -H "Authorization: Bearer $TOKEN"
```

## Endpoints (contrato 1.1.0)

| Método | Ruta | Rol | Éxito | Errores |
|---|---|---|---|---|
| POST | `/auth/register` | — | 201 `User` | 400, 409, 429 |
| POST | `/auth/login` | — | 200 `LoginResponse` | 400, 401, 429 |
| GET | `/auth/me` | Cualquiera | 200 `User` | 401 |
| GET | `/products` | Cualquiera | 200 catálogo paginado | 400, 401 |
| GET | `/products/categories` | Cualquiera | 200 `string[]` | 401 |
| GET | `/products/:id` | Cualquiera | 200 `Product` | 400, 401, 404 |
| GET | `/products/:id/images/:imageId` (y `/thumb`) | Público, sin token | 200 binario `image/webp` | 400, 404 |
| GET | `/seller/products` | `seller` | 200 mis productos paginados | 400, 401, 403 |
| GET | `/seller/products/:id` | `seller` | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products` | `seller` | 201 `Product` | 400, 401, 403, 409 |
| PATCH | `/seller/products/:id` | `seller` | 200 `Product` | 400, 401, 403, 404, 409 |
| DELETE | `/seller/products/:id` | `seller` | 204 | 400, 401, 403, 404 |
| POST | `/seller/products/:id/stock-adjustments` | `seller` | 200 `Product` | 400, 401, 403, 404, 409 |
| PUT / DELETE | `/seller/products/:id/discount` | `seller` | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products/:id/images` | `seller` | 201 `Product` | 400, 401, 403, 404, 409, 413, 415 |
| DELETE | `/seller/products/:id/images/:imageId` | `seller` | 200 `Product` | 400, 401, 403, 404 |
| PUT | `/seller/products/:id/images/order` | `seller` | 200 `Product` | 400, 401, 403, 404 |

- **Roles y productos ajenos:** un comprador recibe **403** en `/seller/...`. Un producto de otro vendedor responde **404**, porque todas las consultas filtran por `{ _id, sellerId }`.
- **Catálogo:** solo muestra productos activos e incluye `seller: { _id, name }` (nunca el email). Filtros: `search` (sin distinguir mayúsculas ni tildes, texto literal), `category`, `minPrice`/`maxPrice` (sobre `finalPrice`), `onSale`, `inStock`, `sortBy` y `order`.
- **Stock y precio final:** el stock solo cambia al crear y con `stock-adjustments` (atómico: nunca queda negativo). `finalPrice` se recalcula en la misma escritura que cambia `price` o el descuento.
- **Imágenes:**
  - Un archivo por petición, en el campo `image`.
  - JPEG, PNG o WebP según su contenido real; máximo 1 MB, 40 megapíxeles y 4 por producto.
  - Se re-codifican a WebP (1200 px y miniatura de 400 × 400) sin metadatos y se guardan en base64 dentro del producto en MongoDB. Los listados y el detalle nunca traen ese base64.
  - Se sirven sin token en `GET /api/v1/products/:id/images/:imageId` (y `/thumb`), solo si el producto está activo.

Todos los errores tienen la forma:

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["price must not be less than 0"], "path": "/api/v1/seller/products", "timestamp": "2026-11-17T21:30:00.000Z" }
```

## Seguridad

- Contraseñas con **bcrypt** (12 rondas). La contraseña nunca aparece en respuestas, logs ni esquemas de Swagger.
- Login con mensaje genérico (`Invalid credentials`) y tiempo de respuesta similar exista o no el email.
- **JWT** HS256 firmado con `JWT_SECRET`; si el usuario fue eliminado, su token deja de servir.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`: rechaza campos desconocidos y operadores de MongoDB como `{"$gt": ""}`. La búsqueda escapa el texto, así que no se puede inyectar una expresión regular.
- **Roles**: `@Roles('seller')` + `RolesGuard` en `/seller/products`. `sellerId` sale siempre del token.
- **Rate limiting** (429):
  - 100 peticiones/min por IP en general.
  - 5/min en `POST /auth/login`.
  - 20/min por usuario en la subida de imágenes.
- **Imágenes**:
  - Multer en memoria, que corta la lectura al pasar 1 MB.
  - Validación por *magic numbers* (`file-type`) y re-codificación con `sharp` (`limitInputPixels`).
  - `Cross-Origin-Resource-Policy: cross-origin` solo en el endpoint público de imágenes.
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
├── modules/
│   ├── auth/               # registro, login, JWT strategy/guard, @CurrentUser
│   ├── users/              # schema y servicio de usuarios
│   ├── products/           # schemas, DTOs, servicio, CatalogController, ProductImagesController, SellerProductsController, pricing
│   └── images/             # multer.config, ImageFilePipe, ImageProcessingService (sharp)
└── scripts/                # export-openapi.ts y seed.ts
seed/                       # products.json e imágenes de ejemplo
test/app.e2e-spec.ts        # criterios de aceptación de las specs 01 §11 y 03 §17
```

Los controladores solo reciben y responden, la lógica está en los servicios y el acceso a datos va por los modelos de Mongoose inyectados.

## Decisiones

- **Eliminación física**: `DELETE` borra el documento.
- **Registro abierto**: cualquiera puede registrarse, para facilitar la evaluación.
- **Lecturas protegidas**: también el catálogo requiere JWT.
- **Producto ajeno → 404**, no 403: no revela si el producto existe.
- **Imágenes en base64 dentro de MongoDB** (máximo 4 de 1 MB por producto, muy por debajo de los 16 MB de BSON): sin archivos que sincronizar ni limpiar. Con más volumen se usaría S3 o Cloudinary (decisión D19).
- Las decisiones de la implementación de la spec 03 están en [docs/specs/IMPLEMENTATION_LOG.md](../docs/specs/IMPLEMENTATION_LOG.md).
- En `PATCH`, enviar `null` borra `description` o `category`; para campos obligatorios devuelve 400.
- NestJS 12 es ESM-only y su CLI trae Vitest y oxlint, que se usan en lugar de Jest y ESLint.
