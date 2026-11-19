# Contrato de la API (Backend ↔ Frontend)

> Fuente única de verdad entre `01-backend.md`, `02-frontend.md` y `03-mejoras-roles-vendedor-comprador.md`.
> Si cambia algo aquí, se actualizan el backend, el frontend y `docs/openapi.json`.
> Versión del contrato: **1.1.0** (ver historial de cambios en la sección 10)

## 1. Generalidades

| Tema | Valor |
|---|---|
| URL base (local) | `http://localhost:3000/api/v1` |
| Variable en el frontend | `VITE_API_URL` |
| Formato | JSON (`Content-Type: application/json`), UTF-8. Excepción: la subida de imágenes usa `multipart/form-data`. |
| Autenticación | `Authorization: Bearer <accessToken>` en todos los endpoints marcados con 🔒 |
| Roles | `seller` (vendedor) y `buyer` (comprador). Columna "Rol" de la sección 2. |
| Fechas | ISO 8601 en UTC (`2026-11-17T21:30:00.000Z`) |
| Identificadores | ObjectId de MongoDB como string de 24 caracteres hexadecimales, en el campo `_id` |
| Imágenes | URLs absolutas en `http://localhost:3000/api/v1/products/:id/images/:imageId` (y `/thumb`). Públicas: no necesitan token. Se guardan en MongoDB. |
| Origen permitido (CORS) | `http://localhost:5173` (`CORS_ORIGIN`) |
| Documentación interactiva | `http://localhost:3000/api/docs` |

## 2. Resumen de endpoints

### 2.1 Auth

| Método | Ruta | 🔒 | Rol | Éxito | Errores posibles |
|---|---|---|---|---|---|
| POST | `/auth/register` | No | — | 201 `User` | 400, 409, 429 |
| POST | `/auth/login` | No | — | 200 `LoginResponse` | 400, 401, 429 |
| GET | `/auth/me` | Sí | Cualquiera | 200 `User` | 401 |

### 2.2 Catálogo

| Método | Ruta | 🔒 | Rol | Éxito | Errores posibles |
|---|---|---|---|---|---|
| GET | `/products` | Sí | Cualquiera | 200 `PaginatedResponse<Product>` | 400, 401 |
| GET | `/products/categories` | Sí | Cualquiera | 200 `string[]` | 401 |
| GET | `/products/:id` | Sí | Cualquiera | 200 `Product` | 400, 401, 404 |
| GET | `/products/:id/images/:imageId` | No | — | 200 binario `image/webp` | 400, 404 |
| GET | `/products/:id/images/:imageId/thumb` | No | — | 200 binario `image/webp` | 400, 404 |

Solo incluye productos con `isActive: true`. Un producto oculto responde 404 en el detalle y en sus imágenes.

Los dos endpoints de imagen son las URLs que devuelven `url` y `thumbUrl`. No piden token (una etiqueta `<img>` no envía `Authorization`) y responden con `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` y `Cross-Origin-Resource-Policy: cross-origin`. Una imagen que no existe, o de un producto oculto o inexistente, responde 404 `"Image not found"`.

### 2.3 Productos del vendedor

Siempre se trabaja sobre los productos del vendedor del token. Un producto de otro vendedor responde **404**. Un usuario con rol `buyer` recibe **403** en todos estos endpoints.

| Método | Ruta | 🔒 | Rol | Éxito | Errores posibles |
|---|---|---|---|---|---|
| GET | `/seller/products` | Sí | `seller` | 200 `PaginatedResponse<Product>` | 400, 401, 403 |
| GET | `/seller/products/:id` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products` | Sí | `seller` | 201 `Product` | 400, 401, 403, 409 |
| PATCH | `/seller/products/:id` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404, 409 |
| DELETE | `/seller/products/:id` | Sí | `seller` | 204 (sin cuerpo) | 400, 401, 403, 404 |
| POST | `/seller/products/:id/stock-adjustments` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404, 409 |
| PUT | `/seller/products/:id/discount` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404 |
| DELETE | `/seller/products/:id/discount` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products/:id/images` | Sí | `seller` | 201 `Product` | 400, 401, 403, 404, 409, 413, 415 |
| DELETE | `/seller/products/:id/images/:imageId` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404 |
| PUT | `/seller/products/:id/images/order` | Sí | `seller` | 200 `Product` | 400, 401, 403, 404 |

Cualquier endpoint puede devolver además `429` (límite de peticiones) o `500`.

## 3. Tipos compartidos

Estos tipos se copian en `frontend/src/types/` y deben coincidir con los DTOs de respuesta del backend.

```ts
// ---------- Usuarios y autenticación ----------
export type UserRole = 'seller' | 'buyer';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  // password NUNCA viene en ninguna respuesta
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
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
export interface ProductImage {
  _id: string;
  url: string;      // absoluta, WebP, máximo 1200 px de lado
  thumbUrl: string; // absoluta, WebP, 400 × 400 px
  width: number;    // de la imagen grande
  height: number;
}

export interface SellerSummary {
  _id: string;
  name: string;     // el email del vendedor nunca se expone
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;           // precio de lista
  discountPercent: number; // 0 = sin descuento
  finalPrice: number;      // calculado por el backend
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  images: ProductImage[];  // images[0] es la principal; puede estar vacío
  seller: SellerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;           // stock inicial
  category?: string;
  sku: string;
  isActive?: boolean;
}

// El stock no se edita aquí: se usa StockAdjustmentRequest.
// `null` en description o category borra el campo.
export type UpdateProductRequest = Partial<Omit<CreateProductRequest, 'stock' | 'description' | 'category'>> & {
  description?: string | null;
  category?: string | null;
};

export interface StockAdjustmentRequest {
  type: 'increase' | 'decrease';
  quantity: number;
}

export interface DiscountRequest {
  percent: number;
}

export interface ReorderImagesRequest {
  imageIds: string[];
}

export type SortOrder = 'asc' | 'desc';
export type SellerProductSortField = 'name' | 'price' | 'finalPrice' | 'stock' | 'createdAt';
export type CatalogSortField = 'createdAt' | 'finalPrice' | 'name' | 'discountPercent';

export interface SellerProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: SellerProductSortField;
  order?: SortOrder;
}

export interface CatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  inStock?: boolean;
  sortBy?: CatalogSortField;
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

El frontend aplica las mismas reglas antes de enviar, para dar feedback inmediato. El backend es quien manda: si el frontend deja pasar algo, el backend lo rechaza.

En todos los cuerpos JSON, cualquier campo que no esté en la tabla correspondiente hace que la petición se rechace con 400.

### 4.1 Usuario

| Campo | Regla |
|---|---|
| `email` | Email válido. Único. Se guarda en minúsculas |
| `password` | Mínimo 8 caracteres, con al menos una letra y un número |
| `name` | 2 a 60 caracteres |
| `role` | Obligatorio. `seller` o `buyer`. No se puede cambiar después |

### 4.2 Producto (crear y editar)

| Campo | Obligatorio al crear | En `PATCH` | Regla |
|---|---|---|---|
| `name` | Sí | Opcional | Texto de 3 a 100 caracteres (sin contar espacios al inicio y final) |
| `description` | No | Opcional | Máximo 500 caracteres |
| `price` | Sí | Opcional | Número ≥ 0 con máximo 2 decimales. Al cambiarlo se recalcula `finalPrice` |
| `stock` | Sí | **No permitido** (400) | Entero ≥ 0 |
| `category` | No | Opcional | Máximo 50 caracteres |
| `sku` | Sí | Opcional | 3 a 30 caracteres. Patrón `^[A-Z0-9-]+$`. Único **por vendedor** |
| `isActive` | No | Opcional | Booleano. Por defecto `true`. `false` lo oculta del catálogo |

Campos que **nunca** se aceptan en el body (400): `sellerId`, `discountPercent`, `finalPrice`, `images`.

En `PATCH`, enviar `null` en `description` o `category` borra el campo. En los campos obligatorios (`name`, `price`, `sku`, `isActive`), `null` responde 400 (`"<campo> should not be null"`).

### 4.3 Ajuste de stock

| Campo | Regla |
|---|---|
| `type` | `increase` o `decrease` |
| `quantity` | Entero entre 1 y 100 000 |

Una salida mayor al stock actual responde 409 y no cambia nada. El stock nunca queda negativo.

### 4.4 Descuento

| Campo | Regla |
|---|---|
| `percent` | Entero entre 1 y 90 |

`finalPrice = round(price × (100 − discountPercent) / 100, 2)`. Lo calcula siempre el backend. Quitar el descuento deja `discountPercent: 0` y `finalPrice = price`.

El redondeo es a 2 decimales con las mitades hacia arriba, y se calcula en centavos enteros para que no haya errores de coma flotante: `finalPrice = floor((round(price × 100) × (100 − discountPercent) + 50) / 100) / 100`. Ejemplo: 0,05 con 30 % de descuento → 0,04.

`DELETE /discount` sobre un producto sin descuento responde 200 sin cambios (es idempotente).

### 4.5 Imágenes

| Regla | Valor | Error |
|---|---|---|
| Formato de la petición | `multipart/form-data` con un único campo de archivo llamado `image` y sin campos de texto. Campos de texto → `"Too many fields"` | 400 |
| Archivo obligatorio | Sin archivo → `"Image is required"` | 400 |
| Un archivo por petición | Más de uno → `"Too many files"`. Campo con otro nombre → `"Unexpected file field - <campo>"` (p. ej. `"Unexpected file field - file"`) | 400 |
| Tamaño máximo | 1 MB = **1 048 576 bytes**. El servidor deja de leer al pasar el límite | 413 |
| Formatos | JPEG, PNG o WebP. Se rechaza tanto por el `Content-Type` declarado como por el contenido real del archivo. Un archivo que parece una imagen pero no se puede decodificar también responde 415 | 415 |
| Resolución máxima | 40 megapíxeles → `"Image dimensions too large"` | 400 |
| Cantidad por producto | Máximo 4 | 409 |

El servidor re-codifica todas las imágenes a WebP y elimina sus metadatos. Lo que se guarda (en base64, dentro del producto en MongoDB) y se sirve nunca es el archivo original. Ninguna respuesta JSON incluye ese base64.

Orden de las comprobaciones al subir (el primer error que se cumpla es el que se responde): 429 por IP → 401 → 403 → 429 por usuario → errores de Multer (413, 400, 415 por `Content-Type`) → 400 `"Invalid id"` → 400 `"Image is required"` → 415 por contenido → 404 → 409 (ya tiene 4) → 400 por resolución.

Reordenar (`imageIds`):
- Cada elemento debe ser un ObjectId válido y no puede repetirse (400 de validación, como el resto de cuerpos).
- Debe contener **exactamente** los ids actuales del producto, sin repetidos ni faltantes. Si no → 400 `["imageIds must contain exactly the current image ids"]`.
- `[]` solo es válido si el producto no tiene imágenes (responde 200 sin cambios).
- Si otra petición agrega o quita una imagen al mismo tiempo, la comparación falla y responde 400; el frontend recarga el producto.

### 4.6 Query de `GET /products` (catálogo)

| Param | Default | Regla |
|---|---|---|
| `page` | 1 | Entero ≥ 1 |
| `limit` | 12 | Entero entre 1 y 48 |
| `search` | — | Texto de hasta 100 caracteres. Busca en `name` sin distinguir mayúsculas ni tildes (`cafe` encuentra `Café`). Se busca literal (los caracteres especiales no son expresiones regulares) |
| `category` | — | Hasta 50 caracteres. Coincidencia exacta (distingue mayúsculas y tildes) |
| `minPrice` | — | Número ≥ 0, sobre `finalPrice` |
| `maxPrice` | — | Número ≥ 0, sobre `finalPrice`. Si `minPrice > maxPrice` → 400 |
| `onSale` | `false` | `true` o `false` (texto). `true` = solo productos con descuento. Cualquier otro valor cuenta como `false` |
| `inStock` | `false` | `true` o `false` (texto). `true` = solo productos con `stock > 0`. Cualquier otro valor cuenta como `false` |
| `sortBy` | `createdAt` | `createdAt`, `finalPrice`, `name` o `discountPercent` |
| `order` | `desc` | `asc` o `desc` |

### 4.7 Query de `GET /seller/products`

| Param | Default | Regla |
|---|---|---|
| `page` | 1 | Entero ≥ 1 |
| `limit` | 10 | Entero entre 1 y 100 |
| `search` | — | Igual que en el catálogo |
| `sortBy` | `createdAt` | `name`, `price`, `finalPrice`, `stock` o `createdAt` |
| `order` | `desc` | `asc` o `desc` |

Incluye productos activos y ocultos.

`GET /products/categories` devuelve las categorías distintas de los productos activos, ordenadas alfabéticamente en español (sin distinguir mayúsculas ni tildes). No incluye productos sin categoría.

En ambos listados, si `page` es mayor que `totalPages`, la respuesta trae `data: []` con el `meta` correcto (no es un error).

## 5. Ejemplos

### 5.1 Registro

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "email": "ana@correo.com", "password": "Clave1234", "name": "Ana Pérez", "role": "seller" }
```

`201 Created`
```json
{
  "_id": "6739f2a1c4e5b8a9d0f12345",
  "email": "ana@correo.com",
  "name": "Ana Pérez",
  "role": "seller",
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

### 5.3 Catálogo con filtros

```http
GET /api/v1/products?category=Caf%C3%A9&onSale=true&maxPrice=40000&sortBy=finalPrice&order=asc
Authorization: Bearer eyJhbGciOi...
```

(`Caf%C3%A9` es `Café` codificado para la URL.)

`200 OK`
```json
{
  "data": [
    {
      "_id": "6739f3b2c4e5b8a9d0f12346",
      "name": "Café de origen Huila 500 g",
      "description": "Café especial tostado medio",
      "price": 32000,
      "discountPercent": 10,
      "finalPrice": 28800,
      "stock": 120,
      "category": "Café",
      "sku": "CAF-HUI-500",
      "isActive": true,
      "images": [
        {
          "_id": "673a01c9c4e5b8a9d0f12401",
          "url": "http://localhost:3000/api/v1/products/6739f3b2c4e5b8a9d0f12346/images/673a01c9c4e5b8a9d0f12401",
          "thumbUrl": "http://localhost:3000/api/v1/products/6739f3b2c4e5b8a9d0f12346/images/673a01c9c4e5b8a9d0f12401/thumb",
          "width": 1200,
          "height": 1200
        }
      ],
      "seller": { "_id": "6739f2a1c4e5b8a9d0f12345", "name": "Ana Pérez" },
      "createdAt": "2026-11-17T21:35:00.000Z",
      "updatedAt": "2026-11-18T14:10:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 12, "total": 1, "totalPages": 1 }
}
```

### 5.4 Crear producto (vendedor)

```http
POST /api/v1/seller/products
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

`201 Created` → objeto `Product` completo con `isActive: true`, `discountPercent: 0`, `finalPrice: 145000`, `images: []`, `seller` y fechas.

### 5.5 Editar producto (vendedor)

```http
PATCH /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "price": 30000, "isActive": false }
```

`200 OK` → `Product` actualizado. Si tenía 10 % de descuento, `finalPrice` pasa a `27000`.

### 5.6 Ajustar stock

```http
POST /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/stock-adjustments
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "type": "decrease", "quantity": 3 }
```

`200 OK` → `Product` con `stock` reducido en 3. Si había menos de 3 → `409 "Insufficient stock"`.

### 5.7 Aplicar y quitar descuento

```http
PUT /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/discount
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "percent": 15 }
```

`200 OK` → `Product` con `discountPercent: 15` y `finalPrice` recalculado.

```http
DELETE /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/discount
Authorization: Bearer eyJhbGciOi...
```

`200 OK` → `Product` con `discountPercent: 0` y `finalPrice` igual a `price`.

### 5.8 Subir imagen

```http
POST /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/images
Authorization: Bearer eyJhbGciOi...
Content-Type: multipart/form-data; boundary=----X

------X
Content-Disposition: form-data; name="image"; filename="cafe.jpg"
Content-Type: image/jpeg

<bytes de la imagen>
------X--
```

`201 Created` → `Product` con la imagen nueva al final de `images`.

En el frontend se envía un `FormData` sin fijar el `Content-Type` a mano (axios agrega el `boundary`).

### 5.9 Reordenar imágenes

En este ejemplo el producto ya tiene dos imágenes (`…12401` y `…12402`, en ese orden) y la segunda pasa a ser la principal.

```http
PUT /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/images/order
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "imageIds": ["673a01c9c4e5b8a9d0f12402", "673a01c9c4e5b8a9d0f12401"] }
```

`200 OK` → `Product` con las imágenes en ese orden. La primera queda como principal.

### 5.10 Eliminar imagen y producto

```http
DELETE /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346/images/673a01c9c4e5b8a9d0f12401
Authorization: Bearer eyJhbGciOi...
```

`200 OK` → `Product` sin esa imagen.

```http
DELETE /api/v1/seller/products/6739f3b2c4e5b8a9d0f12346
Authorization: Bearer eyJhbGciOi...
```

`204 No Content` (sin cuerpo). También se borran sus imágenes.

## 6. Errores

### 6.1 Formato único

Todos los errores tienen la forma de `ApiError`:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["price must not be less than 0", "sku must match /^[A-Z0-9-]+$/ regular expression"],
  "path": "/api/v1/seller/products",
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
| 400 | Campo no permitido (incluido `stock` en `PATCH`) | `["property stock should not exist"]` | Notificación genérica de datos inválidos |
| 400 | `id` con formato inválido | `"Invalid id"` | Notificación "El producto no es válido" |
| 400 | Rango de precio inválido | `["minPrice must not be greater than maxPrice"]` | Error junto a los campos de precio |
| 400 | Subida de imagen mal formada (sin archivo, campo distinto de `image`, varios archivos, campos de texto) | `"Image is required"`, `"Unexpected file field - file"`, `"Too many files"`, `"Too many fields"` | "No se pudo subir la imagen." (es un error de programación del frontend, no del usuario) |
| 400 | Imagen de más de 40 megapíxeles | `"Image dimensions too large"` | "La imagen tiene demasiados píxeles. El máximo es 40 megapíxeles." |
| 400 | `imageIds` no coincide con las imágenes actuales | `["imageIds must contain exactly the current image ids"]` | "Las imágenes cambiaron. Vuelve a intentarlo." y recarga el producto |
| 401 | Sin token, token inválido o expirado | `"Unauthorized"` | Cierra sesión y redirige a `/login` con "Tu sesión expiró, inicia sesión de nuevo." |
| 401 | Credenciales incorrectas en login | `"Invalid credentials"` | "Correo o contraseña incorrectos." (sin cerrar sesión, porque no la hay) |
| 403 | El rol no tiene permiso | `"Forbidden"` | Redirige a la pantalla de inicio de su rol con "No tienes acceso a esa sección." |
| 404 | El producto no existe, es de otro vendedor o está oculto (catálogo) | `"Product not found"` | "El producto ya no existe. Es posible que otra persona lo haya eliminado." y recarga de la lista. En el detalle del catálogo: "Este producto ya no está disponible" |
| 404 | La imagen no existe (también en `GET /products/:id/images/...` si el producto está oculto) | `"Image not found"` | "La imagen ya no existe." y recarga del producto. En una `<img>` no se muestra texto |
| 409 | `sku` duplicado en el mismo vendedor | `"SKU already exists"` | "Ya existe un producto con ese SKU." en el campo SKU |
| 409 | `email` duplicado | `"Email already registered"` | "Ya existe una cuenta con ese correo." en el campo email |
| 409 | Salida mayor al stock | `"Insufficient stock"` | "No hay suficiente stock para esa salida." en el diálogo de stock, y actualiza el stock mostrado |
| 409 | El producto ya tiene 4 imágenes | `"Image limit reached"` | "Este producto ya tiene 4 imágenes." |
| 413 | Imagen de más de 1 MB | `"File too large"` | "La imagen pesa más de 1 MB." |
| 415 | Formato de imagen no permitido | `"Unsupported file type"` | "Formato no permitido. Usa JPG, PNG o WebP." |
| 429 | Límite de peticiones | `"Too many requests"` | "Demasiados intentos. Espera un minuto e inténtalo de nuevo." |
| 500 | Error inesperado | `"Internal server error"` | "Ocurrió un error inesperado. Inténtalo más tarde." (sin detalles técnicos) |

Los textos de la columna "Qué hace el frontend" son los que se muestran tal cual en la interfaz.

Para distinguir los distintos 409, el frontend usa la ruta del endpoint (`/seller/products`, `/stock-adjustments`, `/images` o `/auth/register`), no el texto del mensaje.

## 7. Autenticación y roles

1. El usuario se registra eligiendo su rol (`/auth/register`) o inicia sesión (`/auth/login`).
2. El frontend guarda `accessToken` y lo envía en el header `Authorization` de cada petición protegida.
3. Después del login, o al recargar, el frontend llama a `GET /auth/me` para obtener el usuario y su `role`, y redirige según el rol: `seller` → `/seller/products`, `buyer` → `/catalog`.
4. El rol también va dentro del JWT, pero el frontend **no** decodifica el token: usa el `role` de `/auth/me`.
5. Cuando el token expira (por defecto 1 hora), cualquier petición protegida responde 401 y el frontend cierra la sesión.
6. No hay refresh token en esta versión: al expirar, el usuario vuelve a iniciar sesión.

## 8. Límites de peticiones

| Alcance | Límite |
|---|---|
| Global, por IP | 100 peticiones por minuto |
| `POST /auth/login`, por IP | 5 peticiones por minuto |
| `POST /seller/products/:id/images`, por usuario | 20 peticiones por minuto (el mismo límite también se cuenta por IP) |

Los límites se cuentan por endpoint: cada ruta tiene su propio contador. Los dos endpoints públicos de imagen no tienen límite (una página del catálogo pide hasta 48 miniaturas).

## 9. Reglas para cambiar el contrato

- Agregar un campo opcional o un endpoint nuevo: compatible, se sube la versión menor (1.2.0).
- Corregir un error sin cambiar el comportamiento acordado: se sube el parche (1.1.1).
- Renombrar, quitar o volver obligatorio un campo, o cambiar quién puede usar un endpoint: incompatible, se sube la versión mayor y se usaría un prefijo nuevo (`/api/v2`).
- **Excepción mientras sea una prueba técnica**: si la API no tiene clientes externos, el frontend se actualiza en el mismo cambio y la base se reinicia, un cambio incompatible puede salir como versión menor y conservar el prefijo. Debe quedar indicado en el historial como "incompatible". Se usó una vez, en la 1.1.0.
- Todo cambio se refleja en este archivo, en los DTOs del backend, en `frontend/src/types/`, en `docs/openapi.json` (`info.version`) y en `VITE_API_URL` si cambia el prefijo.

## 10. Historial de cambios

### 1.1.0 — Vendedores y compradores (spec 03)
**Incompatible con 1.0.0**: se aplicó la excepción de la regla 9. Antes de usarla hay que borrar la base de datos de la 1.0.0 (sin migración, ver spec 03 §14). El prefijo sigue siendo `/api/v1`.
- `User.role` y `RegisterRequest.role` (obligatorios).
- `/products` pasa a ser el catálogo de solo lectura. La gestión se mueve a `/seller/products`.
- `Product` agrega `discountPercent`, `finalPrice`, `images` y `seller`.
- `sku` deja de ser único global y pasa a ser único por vendedor.
- `stock` ya no se puede enviar en `PATCH`; se usa `/stock-adjustments`.
- Nuevos endpoints de stock, descuento e imágenes.
- Nuevos errores 403, 413 y 415, y nuevos casos de 409.

**Aclaraciones de la revisión previa a la implementación** (sin cambio de versión; el detalle está en `docs/specs/IMPLEMENTATION_LOG.md`):
- Redondeo de `finalPrice` en centavos con las mitades hacia arriba (§4.4).
- `null` en `PATCH` borra `description` o `category` (§3, §4.2).
- Mensajes reales de Multer, error 415 para imágenes que no se pueden decodificar, orden de las comprobaciones al subir y reglas de `imageIds` (§4.5).
- La búsqueda tampoco distingue tildes; `category` hasta 50 caracteres; booleanos con otro valor cuentan como `false`; orden de `/products/categories` (§4.6, §4.7).
- Textos exactos del frontend para cada error, y errores 400 de resolución y de reordenamiento (§6.2).
- Los límites se cuentan por endpoint, y el de subida también por IP (§8).

**Almacenamiento de imágenes en MongoDB** (sin cambio de versión, decisión D19 del registro de implementación):
- Las imágenes se guardan en base64 dentro del producto, no en disco. `url` y `thumbUrl` siguen siendo absolutas, pero apuntan a `GET /products/:id/images/:imageId` (y `/thumb`), públicos y sin token, en lugar de `/uploads/products/...` (§1, §2.2).
- Máximo **4** imágenes por producto (antes 5) (§4.5, §6.2).
- Los tipos de §3 no cambian, así que el frontend tampoco.

### 1.0.0
- Versión inicial: auth y CRUD de productos (specs 01 y 02).
