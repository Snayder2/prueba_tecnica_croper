# Contrato de la API (Backend ↔ Frontend)

> Fuente única de verdad entre `01-backend.md` y `02-frontend.md`.
> Si cambia algo aquí, se actualizan el backend, el frontend y `docs/openapi.json`.
> Versión del contrato: 1.0.0

## 1. Generalidades

| Tema | Valor |
|---|---|
| URL base (local) | `http://localhost:3000/api/v1` |
| Variable en el frontend | `VITE_API_URL` |
| Formato | JSON (`Content-Type: application/json`), UTF-8 |
| Autenticación | `Authorization: Bearer <accessToken>` en todos los endpoints marcados con 🔒 |
| Fechas | ISO 8601 en UTC (`2026-11-17T21:30:00.000Z`) |
| Identificadores | ObjectId de MongoDB como string de 24 caracteres hexadecimales, en el campo `_id` |
| Origen permitido (CORS) | `http://localhost:5173` (`CORS_ORIGIN`) |
| Documentación interactiva | `http://localhost:3000/api/docs` |

## 2. Resumen de endpoints

| Método | Ruta | 🔒 | Éxito | Errores posibles |
|---|---|---|---|---|
| POST | `/auth/register` | No | 201 `User` | 400, 409, 429 |
| POST | `/auth/login` | No | 200 `LoginResponse` | 400, 401, 429 |
| GET | `/auth/me` | Sí | 200 `User` | 401 |
| GET | `/products` | Sí | 200 `PaginatedResponse<Product>` | 400, 401 |
| GET | `/products/:id` | Sí | 200 `Product` | 400, 401, 404 |
| POST | `/products` | Sí | 201 `Product` | 400, 401, 409 |
| PATCH | `/products/:id` | Sí | 200 `Product` | 400, 401, 404, 409 |
| DELETE | `/products/:id` | Sí | 204 (sin cuerpo) | 400, 401, 404 |

Cualquier endpoint puede devolver además `429` (límite global de peticiones) o `500`.

## 3. Tipos compartidos

Estos tipos se copian en `frontend/src/types/` y deben coincidir con los DTOs de respuesta del backend.

```ts
// ---------- Usuarios y autenticación ----------
export interface User {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // password NUNCA viene en ninguna respuesta
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // segundos (3600 = 1 hora)
}

// ---------- Productos ----------
export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive?: boolean;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

export type ProductSortField = 'name' | 'price' | 'stock' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface ProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: ProductSortField;
  order?: SortOrder;
}

// ---------- Respuestas comunes ----------
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
```

## 4. Reglas de validación

El frontend aplica las mismas reglas antes de enviar, para dar feedback inmediato. El backend es quien manda: si el frontend deja pasar algo, el backend lo rechaza con 400.

### 4.1 Producto

| Campo | Obligatorio al crear | Regla |
|---|---|---|
| `name` | Sí | Texto de 3 a 100 caracteres (sin contar espacios al inicio y final) |
| `description` | No | Máximo 500 caracteres |
| `price` | Sí | Número ≥ 0 con máximo 2 decimales |
| `stock` | Sí | Entero ≥ 0 |
| `category` | No | Máximo 50 caracteres |
| `sku` | Sí | 3 a 30 caracteres. Patrón `^[A-Z0-9-]+$`. Único |
| `isActive` | No | Booleano. Por defecto `true` |

En `PATCH` todos los campos son opcionales, pero los que se envían cumplen las mismas reglas.

Cualquier campo que no esté en esta tabla hace que la petición se rechace con 400.

### 4.2 Usuario

| Campo | Regla |
|---|---|
| `email` | Email válido. Único. Se guarda en minúsculas |
| `password` | Mínimo 8 caracteres, con al menos una letra y un número |
| `name` | 2 a 60 caracteres |

### 4.3 Query de `GET /products`

| Param | Default | Regla |
|---|---|---|
| `page` | 1 | Entero ≥ 1 |
| `limit` | 10 | Entero entre 1 y 100 |
| `search` | — | Texto. Busca en `name` sin distinguir mayúsculas |
| `sortBy` | `createdAt` | `name`, `price`, `stock` o `createdAt` |
| `order` | `desc` | `asc` o `desc` |

Si `page` es mayor que `totalPages`, la respuesta trae `data: []` con el `meta` correcto (no es un error).

## 5. Ejemplos

### 5.1 Registro

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "email": "ana@correo.com", "password": "Clave1234", "name": "Ana Pérez" }
```

`201 Created`
```json
{
  "_id": "6739f2a1c4e5b8a9d0f12345",
  "email": "ana@correo.com",
  "name": "Ana Pérez",
  "createdAt": "2026-11-17T21:30:00.000Z",
  "updatedAt": "2026-11-17T21:30:00.000Z"
}
```

### 5.2 Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "ana@correo.com", "password": "Clave1234" }
```

`200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### 5.3 Listar productos

```http
GET /api/v1/products?page=1&limit=10&search=cafe&sortBy=price&order=asc
Authorization: Bearer eyJhbGciOi...
```

`200 OK`
```json
{
  "data": [
    {
      "_id": "6739f3b2c4e5b8a9d0f12346",
      "name": "Café de origen Huila 500 g",
      "description": "Café especial tostado medio",
      "price": 32000,
      "stock": 120,
      "category": "Café",
      "sku": "CAF-HUI-500",
      "isActive": true,
      "createdAt": "2026-11-17T21:35:00.000Z",
      "updatedAt": "2026-11-17T21:35:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### 5.4 Crear producto

```http
POST /api/v1/products
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "name": "Fertilizante NPK 15-15-15 50 kg",
  "price": 145000,
  "stock": 40,
  "category": "Fertilizantes",
  "sku": "FER-NPK-50"
}
```

`201 Created` → objeto `Product` completo (con `_id`, `isActive: true` y fechas).

### 5.5 Actualizar producto

```http
PATCH /api/v1/products/6739f3b2c4e5b8a9d0f12346
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "price": 30000, "stock": 95 }
```

`200 OK` → objeto `Product` completo, ya actualizado.

### 5.6 Eliminar producto

```http
DELETE /api/v1/products/6739f3b2c4e5b8a9d0f12346
Authorization: Bearer eyJhbGciOi...
```

`204 No Content` (sin cuerpo).

## 6. Errores

### 6.1 Formato único

Todos los errores tienen la forma de `ApiError`:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["price must not be less than 0", "sku must match /^[A-Z0-9-]+$/ regular expression"],
  "path": "/api/v1/products",
  "timestamp": "2026-11-17T21:40:00.000Z"
}
```

- En errores de validación (400), `message` es un **arreglo**. Cada mensaje empieza con el nombre del campo, y así el frontend puede mostrarlo junto al campo correcto.
- En los demás errores, `message` es un **texto**.
- El frontend siempre normaliza: `Array.isArray(message) ? message : [message]`.

### 6.2 Catálogo de errores

| Código | Cuándo | `message` de ejemplo | Qué hace el frontend |
|---|---|---|---|
| 400 | Validación del body o del query | `["price must not be less than 0"]` | Muestra cada error junto a su campo |
| 400 | Campo no permitido | `["property foo should not exist"]` | Notificación genérica de datos inválidos |
| 400 | `id` con formato inválido | `"Invalid id"` | Notificación "El producto no es válido" |
| 401 | Sin token, token inválido o expirado | `"Unauthorized"` | Cierra sesión y redirige a `/login` con aviso |
| 401 | Credenciales incorrectas en login | `"Invalid credentials"` | "Correo o contraseña incorrectos" (sin cerrar sesión, porque no la hay) |
| 404 | El producto no existe | `"Product not found"` | Aviso y recarga de la lista |
| 409 | `sku` duplicado | `"SKU already exists"` | Error en el campo SKU |
| 409 | `email` duplicado | `"Email already registered"` | Error en el campo email |
| 429 | Límite de peticiones | `"Too many requests"` | "Demasiados intentos. Espera un minuto" |
| 500 | Error inesperado | `"Internal server error"` | Mensaje genérico, sin detalles técnicos |

Para distinguir los dos 409, el frontend usa la ruta del endpoint (`/products` o `/auth/register`), no el texto del mensaje.

## 7. Autenticación

1. El usuario se registra (`/auth/register`) o inicia sesión (`/auth/login`).
2. El frontend guarda `accessToken` y lo envía en el header `Authorization` de cada petición protegida.
3. Al recargar la página, el frontend llama a `GET /auth/me` para recuperar los datos del usuario y confirmar que el token sigue vigente.
4. Cuando el token expira (por defecto 1 hora), cualquier petición protegida responde 401 y el frontend cierra la sesión.
5. No hay refresh token en esta versión: al expirar, el usuario vuelve a iniciar sesión.

## 8. Límites de peticiones

| Alcance | Límite |
|---|---|
| Global, por IP | 100 peticiones por minuto |
| `POST /auth/login`, por IP | 5 peticiones por minuto |

## 9. Reglas para cambiar el contrato

- Agregar un campo opcional o un endpoint nuevo: compatible, se sube la versión menor (1.1.0).
- Renombrar, quitar o volver obligatorio un campo: incompatible, se sube la versión mayor y se usaría un prefijo nuevo (`/api/v2`).
- Todo cambio se refleja en este archivo, en los DTOs del backend, en `frontend/src/types/` y en `docs/openapi.json`.
