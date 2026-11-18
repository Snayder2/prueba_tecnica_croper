# Spec 01 – Backend: API de Productos (NestJS + MongoDB)

> Estado: borrador para revisión
> Ejercicio: 1 de la prueba técnica Full Stack

## 1. Objetivo

Construir una API REST con NestJS y MongoDB para gestionar productos. Debe tener CRUD completo, validaciones, documentación con Swagger y endpoints protegidos con JWT.

Se evaluará estructura, buenas prácticas, seguridad y claridad en el diseño.

## 2. Alcance

**Incluye**
- Registro e inicio de sesión de usuarios (para obtener el JWT).
- CRUD de productos protegido con JWT.
- Listado con paginación y búsqueda por nombre (lo necesitará el frontend).
- Validación de datos de entrada y respuestas de error consistentes.
- Documentación Swagger con soporte para probar endpoints con token.
- Medidas básicas de seguridad (hash de contraseñas, rate limiting, headers seguros, CORS).

**No incluye (fuera de alcance)**
- Roles y permisos (admin/usuario). Se menciona como mejora futura.
- Refresh tokens.
- Subida de imágenes de productos.
- Despliegue en la nube (se explica en el PDF, ejercicio 5).

## 3. Stack y decisiones técnicas

| Tema | Elección | Por qué |
|---|---|---|
| Framework | NestJS (TypeScript) | Requisito de la prueba. Estructura modular y DI. |
| Base de datos | MongoDB local (Community Server) | Requisito. URI configurable para usar Atlas sin cambiar código. |
| ODM | `@nestjs/mongoose` | Integración oficial, schemas tipados. |
| Validación | `class-validator` + `class-transformer` | Estándar en NestJS, se integra con Swagger. |
| Auth | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` | Patrón oficial de NestJS. |
| Hash de contraseñas | `bcrypt` | Algoritmo lento por diseño, resistente a fuerza bruta. |
| Documentación | `@nestjs/swagger` | Requisito. Genera la doc desde los decoradores. |
| Configuración | `@nestjs/config` + validación de variables al arrancar | La app no arranca si falta una variable crítica. |
| Seguridad extra | `helmet`, `@nestjs/throttler`, CORS restringido | Headers seguros y protección contra fuerza bruta. |
| Tests | Vitest (incluido en NestJS 12) | Unit tests del servicio de productos y auth. NestJS 12 es ESM-only y su CLI trae Vitest y oxlint por defecto. |

## 4. Modelo de datos

### 4.1 Producto (`products`)

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | Generado por MongoDB. |
| `name` | string | Obligatorio. 3 a 100 caracteres. Se guarda sin espacios al inicio/final. |
| `description` | string | Opcional. Máximo 500 caracteres. |
| `price` | number | Obligatorio. Mayor o igual a 0. Máximo 2 decimales. |
| `stock` | number (entero) | Obligatorio. Mayor o igual a 0. |
| `category` | string | Opcional. Máximo 50 caracteres. |
| `sku` | string | Obligatorio. Único. 3 a 30 caracteres, solo letras mayúsculas, números y guiones. |
| `isActive` | boolean | Opcional. Por defecto `true`. |
| `createdAt` / `updatedAt` | Date | Automáticos (`timestamps: true`). |

Índices:
- `sku` único.
- `name` para búsquedas.

### 4.2 Usuario (`users`)

| Campo | Tipo | Reglas |
|---|---|---|
| `_id` | ObjectId | Generado por MongoDB. |
| `email` | string | Obligatorio. Email válido. Único. Se guarda en minúsculas. |
| `password` | string | Obligatorio. Mínimo 8 caracteres, al menos una letra y un número. Se guarda solo el hash. Nunca se devuelve en respuestas. |
| `name` | string | Obligatorio. 2 a 60 caracteres. |
| `createdAt` / `updatedAt` | Date | Automáticos. |

## 5. Endpoints

Prefijo global: `/api/v1`

### 5.1 Auth (públicos)

| Método | Ruta | Descripción | Respuesta OK |
|---|---|---|---|
| POST | `/auth/register` | Crea un usuario | `201` usuario sin contraseña |
| POST | `/auth/login` | Valida credenciales y devuelve token | `200` `{ accessToken, tokenType: "Bearer", expiresIn }` |
| GET | `/auth/me` | Datos del usuario del token (protegido) | `200` usuario sin contraseña |

### 5.2 Productos (todos protegidos con JWT)

| Método | Ruta | Descripción | Respuesta OK |
|---|---|---|---|
| GET | `/products` | Lista paginada | `200` respuesta paginada |
| GET | `/products/:id` | Detalle | `200` producto |
| POST | `/products` | Crear | `201` producto creado |
| PATCH | `/products/:id` | Actualizar parcialmente | `200` producto actualizado |
| DELETE | `/products/:id` | Eliminar | `204` sin contenido |

### 5.3 Paginación y búsqueda

Query params de `GET /products`:

| Param | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | entero | 1 | Mínimo 1 |
| `limit` | entero | 10 | Entre 1 y 100 |
| `search` | string | — | Busca en `name`, sin distinguir mayúsculas |
| `sortBy` | string | `createdAt` | Uno de: `name`, `price`, `stock`, `createdAt` |
| `order` | string | `desc` | `asc` o `desc` |

Formato de respuesta:

```json
{
  "data": [ { "_id": "...", "name": "...", "price": 1200, "...": "..." } ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

## 6. Manejo de errores

Todas las respuestas de error usan el mismo formato:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["price must not be less than 0"],
  "path": "/api/v1/products",
  "timestamp": "2026-11-17T21:30:00.000Z"
}
```

| Caso | Código |
|---|---|
| Datos inválidos o campos no permitidos en el body | 400 |
| `id` que no es un ObjectId válido | 400 |
| Sin token, token inválido o expirado | 401 |
| Credenciales incorrectas en login (mensaje genérico, sin decir si falló el email o la contraseña) | 401 |
| Producto no encontrado | 404 |
| `sku` o `email` duplicado | 409 |
| Demasiados intentos (rate limit) | 429 |
| Error inesperado (sin exponer detalles internos) | 500 |

## 7. Seguridad

1. **JWT**: firmado con `JWT_SECRET` desde variables de entorno, expiración configurable (por defecto 1 hora). Se envía en el header `Authorization: Bearer <token>`.
2. **Contraseñas**: hash con bcrypt (10 rondas o más). Nunca se devuelven ni se registran en logs.
3. **Validación estricta**: `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true` y `transform: true`. Esto descarta campos no esperados y evita inyección de operadores de MongoDB (por ejemplo `{"$gt": ""}`).
4. **Fuerza bruta**: `@nestjs/throttler` global (por ejemplo 100 peticiones por minuto) y más estricto en `/auth/login` (por ejemplo 5 por minuto).
5. **Headers**: `helmet` activado.
6. **CORS**: solo se permite el origen del frontend, configurado con `CORS_ORIGIN`.
7. **Secretos**: nada sensible en el código. `.env` en `.gitignore` y `.env.example` en el repo.
8. **Mensajes de error**: en errores 500 no se expone el stack ni detalles de la base de datos.

## 8. Documentación de la API (Swagger / OpenAPI)

La documentación es parte del entregable: el evaluador debe poder entender y probar toda la API desde Swagger, sin leer el código.

**Acceso**
- Interfaz Swagger UI en `http://localhost:3000/api/docs`.
- Especificación OpenAPI en JSON en `http://localhost:3000/api/docs-json`.
- Una copia exportada en `docs/openapi.json` dentro del repo, para consultarla sin levantar el servidor.

**Información general**
- Título: "API de Productos", descripción breve, versión `1.0.0`.
- Descripción con los pasos para probar: 1) registrarse, 2) hacer login, 3) copiar el token en **Authorize**.
- Esquema de seguridad Bearer (JWT) con el botón **Authorize**.
- `persistAuthorization: true` para que el token no se pierda al recargar la página.

**Organización**
- Endpoints agrupados por tags: `Auth` y `Products`.
- Endpoints protegidos marcados con `@ApiBearerAuth()` (se ve el candado).

**Detalle de cada endpoint**
- `@ApiOperation` con un resumen corto y una descripción cuando haga falta.
- Parámetros de ruta y de query documentados (`id`, `page`, `limit`, `search`, `sortBy`, `order`) con tipo, valor por defecto y ejemplo.
- Body documentado con el DTO correspondiente, con ejemplo realista.
- Todas las respuestas posibles con su código y su esquema: 200/201/204, 400, 401, 404, 409 y 429 según aplique.

**Esquemas (DTOs)**
- DTOs de entrada con `@ApiProperty` / `@ApiPropertyOptional`: descripción, ejemplo, mínimos, máximos y patrones, alineados con las reglas de `class-validator`.
- DTOs de respuesta: `ProductResponseDto`, `PaginatedProductsResponseDto`, `UserResponseDto`, `LoginResponseDto` y `ErrorResponseDto` (formato de la sección 6).
- `UpdateProductDto` con `PartialType` de `@nestjs/swagger` para que herede la documentación.
- La contraseña nunca aparece en los esquemas de respuesta.

## 9. Configuración (`.env.example`)

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/productos_db
JWT_SECRET=cambia_esto_por_un_valor_largo_y_aleatorio
JWT_EXPIRES_IN=1h
CORS_ORIGIN=http://localhost:5173
```

La app valida estas variables al arrancar y falla con un mensaje claro si falta alguna.

## 10. Estructura de carpetas

```
backend/src/
├── main.ts
├── app.module.ts
├── config/
│   └── env.validation.ts
├── common/
│   ├── dto/
│   ├── filters/
│   ├── pipes/
│   └── interfaces/
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── dto/
    │   ├── strategies/
    │   ├── guards/
    │   └── decorators/
    ├── users/
    │   ├── users.module.ts
    │   ├── users.service.ts
    │   └── schemas/
    └── products/
        ├── products.module.ts
        ├── products.controller.ts
        ├── products.service.ts
        ├── dto/
        └── schemas/
```

Principio: los controladores solo reciben y responden; la lógica va en los servicios; el acceso a datos va por los modelos de Mongoose inyectados en los servicios.

## 11. Criterios de aceptación

**Auth**
- [ ] `POST /auth/register` con datos válidos devuelve 201 y la respuesta no incluye `password`.
- [ ] Registrar un email ya existente devuelve 409.
- [ ] `POST /auth/login` con credenciales válidas devuelve un `accessToken`.
- [ ] Login con contraseña incorrecta devuelve 401 con mensaje genérico.
- [ ] Más de 5 intentos de login por minuto devuelven 429.

**Productos**
- [ ] Cualquier endpoint de productos sin token devuelve 401.
- [ ] `POST /products` con datos válidos devuelve 201 con el producto creado.
- [ ] `POST /products` con `price` negativo, `name` vacío o `stock` decimal devuelve 400 con mensajes claros.
- [ ] Enviar un campo no definido en el DTO devuelve 400.
- [ ] Crear dos productos con el mismo `sku` devuelve 409.
- [ ] `GET /products?page=2&limit=5` devuelve 5 elementos y `meta` correcto.
- [ ] `GET /products?search=cafe` encuentra "Café" y "CAFETERA" (sin distinguir mayúsculas).
- [ ] `GET /products/abc` devuelve 400 (id inválido).
- [ ] `GET /products/<id inexistente válido>` devuelve 404.
- [ ] `PATCH /products/:id` actualiza solo los campos enviados.
- [ ] `DELETE /products/:id` devuelve 204, y un segundo `DELETE` devuelve 404.

**Calidad**
- [ ] Swagger en `/api/docs` muestra todos los endpoints agrupados en `Auth` y `Products`.
- [ ] Desde Swagger se puede hacer el flujo completo: registro, login, **Authorize** con el token y CRUD de productos.
- [ ] Cada endpoint muestra ejemplos de body y todas sus respuestas posibles, incluidos los errores.
- [ ] `docs/openapi.json` está en el repo y coincide con la API actual.
- [ ] La app no arranca si falta `JWT_SECRET` o `MONGO_URI`.
- [ ] Tests unitarios de `ProductsService` y `AuthService` pasan con `npm test`.
- [ ] `npm run lint` sin errores.

## 12. Tareas de implementación

Cada tarea se le pide a la IA por separado y se valida antes de pasar a la siguiente.

1. Crear el proyecto NestJS, instalar dependencias y configurar `@nestjs/config` con validación de variables.
2. Conectar MongoDB con `MongooseModule.forRootAsync`.
3. Configurar `main.ts`: prefijo `/api/v1`, `ValidationPipe` global, `helmet`, CORS y Swagger.
4. Crear `common/`: filtro de excepciones, `ParseObjectIdPipe`, DTO de paginación.
5. Módulo `products`: schema, DTOs con validaciones y `@ApiProperty`, servicio y controlador con el CRUD.
6. Paginación, búsqueda y ordenamiento en `GET /products`.
7. Módulo `users`: schema y servicio (crear, buscar por email, buscar por id).
8. Módulo `auth`: registro con bcrypt, login con JWT, estrategia y guard.
9. Proteger el controlador de productos con `JwtAuthGuard` y documentar Bearer en Swagger.
10. Configurar `@nestjs/throttler` (global y estricto en login).
11. Tests unitarios de `ProductsService` y `AuthService`.
12. Completar la documentación Swagger: DTOs de respuesta, `@ApiResponse` de errores, ejemplos y tags. Agregar un script `npm run docs:export` que genere `docs/openapi.json`.
13. README del backend: requisitos, instalación, variables, ejecución, enlace a Swagger y ejemplos de uso.

## 13. Decisiones abiertas (para revisar)

- **Eliminación física vs lógica**: la spec usa eliminación física (`DELETE` borra el documento). Alternativa: marcar `isActive=false`. Se eligió física por simplicidad y porque el ejercicio pide un CRUD básico.
- **Registro abierto**: cualquiera puede registrarse para facilitar la evaluación. En producción se restringiría (invitación o rol admin).
- **GET protegido**: también se protegen las lecturas, porque el requisito dice "protección de endpoints" sin excepciones.
