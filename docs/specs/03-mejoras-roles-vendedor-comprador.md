# Spec 03 – Mejoras: Vendedores, Compradores, Imágenes, Stock y Descuentos

> Estado: implementada (contrato 1.1.0). Registro de la implementación: [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md)
> Mejora adicional sobre los ejercicios 1 y 2 (no reemplaza ningún ejercicio de la prueba)
> Modifica `docs/specs/01-backend.md`, `docs/specs/02-frontend.md` y `docs/specs/api-contract.md`

## 1. Objetivo

Convertir la app en un pequeño marketplace con dos tipos de usuario:

- **Vendedor (`seller`)**: administra **sus** productos desde una tabla. Puede crear, editar, subir imágenes (máximo 1 MB cada una), ajustar el stock desde una acción aparte y aplicar descuentos.
- **Comprador (`buyer`)**: navega por el catálogo de todos los vendedores en formato de tarjetas con imágenes, con filtros para encontrar lo que quiere comprar.

## 2. Alcance

**Incluye**
- Rol de usuario elegido al registrarse (`seller` o `buyer`) y autorización por rol.
- Productos asociados al vendedor que los crea. Un vendedor solo ve y modifica los suyos.
- Imágenes de producto: hasta 4 por producto, máximo 1 MB cada una, JPEG, PNG o WebP. La primera es la principal. Se guardan en base64 dentro del producto en MongoDB (sección 7.5).
- Ajuste de stock como acción independiente (entrada / salida), atómico y sin dejar stock negativo.
- Descuento porcentual por producto, con precio final calculado por el backend.
- Activar/ocultar un producto del catálogo.
- Catálogo para compradores: tarjetas, filtros (texto, categoría, rango de precio, con descuento, disponibles), ordenamiento y página de detalle con galería.
- Script de datos de prueba. Se parte de una base vacía (sección 14).

**No incluye (fuera de alcance)**
- Carrito, órdenes, pagos y envíos (candidato a spec 04).
- Historial de movimientos de stock (se menciona como mejora futura).
- Descuentos con fecha de inicio/fin, cupones o descuentos por cantidad.
- Un usuario con los dos roles a la vez, o un rol `admin`.
- Almacenamiento de imágenes en archivos, en disco o en la nube (S3, Cloudinary): se guardan en MongoDB (ver 7.5).

## 3. Resumen de cambios

| Área | Cambio |
|---|---|
| Contrato | Pasa a **1.1.0** y se mantiene el prefijo `/api/v1`. Hay cambios incompatibles, pero como no hay clientes externos y la base se borra, se aplica la excepción de la regla 9 del contrato. Ya está aplicado en `api-contract.md`. |
| Datos | Se borra la base de 1.0; no hay migración. |
| Usuario | Nuevo campo `role`. Se incluye en el JWT. |
| Producto | Nuevos campos `sellerId`, `images`, `discountPercent`, `finalPrice`. `sku` pasa a ser único **por vendedor**. |
| Rutas | `/products` pasa a ser el catálogo (solo lectura). La gestión se mueve a `/seller/products`. |
| Stock | Ya no se modifica con `PATCH`; solo al crear y con el endpoint de ajuste. |
| Frontend | Redirección por rol, vista de vendedor ampliada, nueva vista de catálogo y detalle de producto. |

## 4. Roles y permisos

| Acción | Sin sesión | `buyer` | `seller` |
|---|---|---|---|
| Registrarse / login | ✅ | — | — |
| Ver catálogo y detalle (`/products`) | ❌ 401 | ✅ | ✅ en la API; en el frontend no (sección 13.1) |
| Listar mis productos (`/seller/products`) | ❌ 401 | ❌ 403 | ✅ solo los suyos |
| Crear, editar, eliminar | ❌ 401 | ❌ 403 | ✅ solo los suyos |
| Imágenes, stock, descuento | ❌ 401 | ❌ 403 | ✅ solo los suyos |

**Implementación**
- Decorador `@Roles('seller')` + `RolesGuard` que lee `role` del usuario del token. Se aplica a nivel de controlador en `SellerProductsController`.
- El `role` va en el payload del JWT (`{ sub, email, role }`). La `JwtStrategy` igual comprueba que el usuario exista para no aceptar tokens de usuarios borrados.
- **Producto de otro vendedor → 404**, no 403. Todas las consultas del vendedor filtran por `{ _id, sellerId }`, así que un producto ajeno simplemente "no existe" para él. El 403 se reserva para el rol equivocado.

## 5. Modelo de datos

### 5.1 Usuario (`users`) – cambios

| Campo | Tipo | Reglas |
|---|---|---|
| `role` | string | Obligatorio. `seller` o `buyer`. No se puede cambiar después del registro en esta versión. |

### 5.2 Producto (`products`) – cambios

| Campo | Tipo | Reglas |
|---|---|---|
| `sellerId` | ObjectId (ref `User`) | Obligatorio. Lo asigna el backend desde el token, **nunca** viene en el body. |
| `images` | `ProductImage[]` | Máximo 4. El orden importa: `images[0]` es la principal. Por defecto `[]`. |
| `discountPercent` | number (entero) | 0 a 90. `0` = sin descuento. Por defecto `0`. |
| `finalPrice` | number | Calculado por el backend: `round(price × (100 − discountPercent) / 100, 2)`. Se guarda para poder filtrar y ordenar por precio final. |
| `sku` | string | Mismas reglas de formato, pero ahora es único **por vendedor** (dos vendedores pueden usar el mismo SKU). |
| `stock` | number (entero) | Mismas reglas. Solo se fija al crear; luego cambia solo por ajuste de stock (sección 8). |

`ProductImage` (subdocumento):

| Campo | Tipo | Descripción |
|---|---|---|
| `_id` | ObjectId | Identificador de la imagen. |
| `mimeType` | string | Tipo de `data` y `thumbData`: siempre `image/webp` (el servidor re-codifica). No se expone en la API. |
| `data` | string | Imagen grande (WebP, máx. 1200 px) en base64. `select: false`. No se expone en la API. |
| `thumbData` | string | Miniatura (WebP, 400 px) en base64. `select: false`. No se expone en la API. |
| `url` | string | URL absoluta de la imagen grande: `GET /products/:id/images/:imageId` (sección 7.4). |
| `thumbUrl` | string | URL absoluta de la miniatura: la misma más `/thumb`. Para tarjetas y tabla. |
| `width` / `height` | number | Tamaño de la imagen grande, para reservar espacio y evitar saltos de diseño. |

**Los listados y el detalle nunca traen el base64.** Todas las consultas de productos usan la proyección `WITHOUT_IMAGE_DATA` (`{ 'images.data': 0, 'images.thumbData': 0 }`), incluidas las escrituras que devuelven el producto, y `toProductView` solo copia `_id`, `url`, `thumbUrl`, `width` y `height`. Solo el endpoint público de la sección 7.4 lee `data` o `thumbData`, y de una sola imagen.

**Índices**
- `{ sellerId: 1, sku: 1 }` único (reemplaza al índice único de `sku`).
- `{ sellerId: 1, createdAt: -1 }` para la tabla del vendedor.
- `{ isActive: 1, createdAt: -1 }`, `{ isActive: 1, finalPrice: 1 }` y `{ category: 1 }` para el catálogo.
- `name` se mantiene para búsquedas.

## 6. Endpoints (`/api/v1`)

### 6.1 Auth

| Método | Ruta | Acceso | Éxito | Errores |
|---|---|---|---|---|
| POST | `/auth/register` | Público | 201 `User` | 400, 409, 429 |
| POST | `/auth/login` | Público | 200 `LoginResponse` | 400, 401, 429 |
| GET | `/auth/me` | Cualquier rol | 200 `User` | 401 |

`RegisterRequest` ahora exige `role`. `User` ahora incluye `role`.

### 6.2 Catálogo (cualquier usuario autenticado)

| Método | Ruta | Éxito | Errores |
|---|---|---|---|
| GET | `/products` | 200 `PaginatedResponse<Product>` | 400, 401 |
| GET | `/products/categories` | 200 `string[]` (categorías de productos activos, ordenadas) | 401 |
| GET | `/products/:id` | 200 `Product` | 400, 401, 404 |

- Solo devuelve productos con `isActive: true`. Uno oculto responde 404 en el detalle.
- La ruta `/products/categories` se declara **antes** de `/products/:id`, o el `ParseObjectIdPipe` respondería 400 a `"categories"`.

Query de `GET /products`:

| Param | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | entero | 1 | ≥ 1 |
| `limit` | entero | 12 | Entre 1 y 48 (múltiplos de 2, 3 y 4 encajan en la grilla) |
| `search` | string | — | Busca en `name` sin distinguir mayúsculas. Máx. 100 caracteres. |
| `category` | string | — | Coincidencia exacta. |
| `minPrice` | number | — | ≥ 0. Se aplica sobre `finalPrice`. |
| `maxPrice` | number | — | ≥ 0. Se aplica sobre `finalPrice`. Si `minPrice > maxPrice` → 400. |
| `onSale` | boolean | `false` | `true` = solo con `discountPercent > 0`. |
| `inStock` | boolean | `false` | `true` = solo con `stock > 0`. |
| `sortBy` | string | `createdAt` | `createdAt`, `finalPrice`, `name`, `discountPercent` |
| `order` | string | `desc` | `asc` o `desc` |

> **Ojo con los booleanos en query**: llegan como texto. Con conversión implícita, `"false"` se convierte en `true`. Se usa `@Transform(({ value }) => value === 'true')` en `onSale` e `inStock`.

> **Búsqueda**: el texto se escapa antes de usarlo en el `$regex` (`escapeRegExp`, en `common/utils/escape-regexp.ts`) para evitar expresiones costosas (ReDoS) o patrones inyectados. Después, `buildSearchRegex` (`common/utils/search-regex.util.ts`, de la 1.0) cambia cada vocal por su grupo con tildes, para que `cafe` encuentre `Café`. Aplica también a la búsqueda del vendedor.

> **`category`**: hasta 50 caracteres, coincidencia exacta. `GET /products/categories` ordena con collation `es` (sin distinguir mayúsculas ni tildes) y omite los productos sin categoría.

### 6.3 Vendedor (solo `seller`, solo sus productos)

| Método | Ruta | Descripción | Éxito | Errores |
|---|---|---|---|---|
| GET | `/seller/products` | Mis productos (activos y ocultos), paginados | 200 `PaginatedResponse<Product>` | 400, 401, 403 |
| GET | `/seller/products/:id` | Detalle | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products` | Crear (incluye `stock` inicial) | 201 `Product` | 400, 401, 403, 409 |
| PATCH | `/seller/products/:id` | Editar datos (sin `stock`) | 200 `Product` | 400, 401, 403, 404, 409 |
| DELETE | `/seller/products/:id` | Eliminar (y sus imágenes) | 204 | 400, 401, 403, 404 |
| POST | `/seller/products/:id/stock-adjustments` | Entrada o salida de stock | 200 `Product` | 400, 401, 403, 404, 409 |
| PUT | `/seller/products/:id/discount` | Aplicar o cambiar descuento | 200 `Product` | 400, 401, 403, 404 |
| DELETE | `/seller/products/:id/discount` | Quitar descuento | 200 `Product` | 400, 401, 403, 404 |
| POST | `/seller/products/:id/images` | Subir **una** imagen (`multipart/form-data`, campo `image`) | 201 `Product` | 400, 401, 403, 404, 409, 413, 415 |
| DELETE | `/seller/products/:id/images/:imageId` | Eliminar una imagen | 200 `Product` | 400, 401, 403, 404 |
| PUT | `/seller/products/:id/images/order` | Reordenar (la primera es la principal). El frontend ya no lo usa (sección 13.4), pero sigue en el contrato | 200 `Product` | 400, 401, 403, 404 |

- Query de `GET /seller/products`: igual que en 1.0 (`page`, `limit`, `search`, `sortBy`, `order`), más `sortBy=finalPrice`.
- Las acciones de stock, descuento e imágenes devuelven el `Product` completo actualizado, para que el frontend reemplace la fila sin volver a pedir la lista.
- `PATCH` no acepta `stock`, `discountPercent`, `finalPrice`, `images` ni `sellerId`: con `forbidNonWhitelisted` responden 400. Cada cosa tiene su endpoint.

## 7. Imágenes

### 7.1 Reglas

| Regla | Valor | Error |
|---|---|---|
| Tamaño máximo | **1 MB = 1 048 576 bytes** por archivo | 413 `"File too large"` |
| Formatos | JPEG, PNG, WebP (se valida el contenido real, no solo la extensión ni el `Content-Type`) | 415 `"Unsupported file type"` |
| Cantidad | Máximo 4 por producto | 409 `"Image limit reached"` |
| Archivos por petición | 1 | 400 |
| Resolución máxima de entrada | 40 megapíxeles (evita "bombas" de descompresión) | 400 `"Image dimensions too large"` |

### 7.2 Recepción del archivo con Multer

Nest procesa `multipart/form-data` con **Multer**, que ya viene dentro de `@nestjs/platform-express`. No hace falta instalar `multer`; solo `@types/multer` como dependencia de desarrollo, para el tipo `Express.Multer.File`.

La configuración vive en un solo archivo, `modules/images/multer.config.ts`, para no repetirla en el controlador:

```ts
import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const MAX_IMAGE_BYTES = 1_048_576; // 1 MB
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(), // el archivo queda en file.buffer; nunca toca el disco sin procesar
  limits: {
    fileSize: MAX_IMAGE_BYTES, // Multer deja de leer al pasarse → 413
    files: 1,                  // un archivo por petición → 400
    fields: 0,                 // no se aceptan campos de texto en el formulario → 400
    parts: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Filtro rápido por el Content-Type declarado. No es la validación real (ver paso 3 de 7.3).
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return cb(new UnsupportedMediaTypeException('Unsupported file type'), false);
    }
    cb(null, true);
  },
};
```

En el controlador:

```ts
@Post(':id/images')
@HttpCode(201)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    required: ['image'],
    properties: { image: { type: 'string', format: 'binary', description: 'JPEG, PNG o WebP, máximo 1 MB' } },
  },
})
@UseGuards(UserThrottlerGuard)
@UseInterceptors(FileInterceptor('image', imageUploadOptions))
uploadImage(
  @Param('id', ParseObjectIdPipe) id: string,
  @UploadedFile(ImageFilePipe) file: Express.Multer.File,
  @CurrentUser() user: PublicUser,
) {
  return this.productsService.addImage(id, user._id, file);
}
```

**Límite por usuario**: el `ThrottlerGuard` global se ejecuta antes que `JwtAuthGuard`, así que no conoce al usuario y cuenta por IP. Por eso la ruta agrega `UserThrottlerGuard` (una subclase de `ThrottlerGuard` cuyo `getTracker` devuelve el id del usuario), que corre después de `JwtAuthGuard` y `RolesGuard`. Con el `@Throttle` de la ruta, el límite de 20 por minuto se cuenta por usuario y también por IP.

Cómo responde cada caso (Nest convierte los errores de Multer en excepciones HTTP y el filtro global les da el formato `ApiError`):

| Caso | Origen | Código | `message` |
|---|---|---|---|
| Archivo de más de 1 MB | Multer `LIMIT_FILE_SIZE` | 413 | `"File too large"` |
| Más de un archivo | Multer `LIMIT_FILE_COUNT` | 400 | `"Too many files"` |
| Campo con otro nombre (p. ej. `file`) | Multer `LIMIT_UNEXPECTED_FILE` | 400 | `"Unexpected file field - file"` (Multer 2 cambió el texto de `"Unexpected field"`, y Nest agrega el nombre del campo) |
| Campos de texto extra | Multer `LIMIT_FIELD_COUNT` | 400 | `"Too many fields"` |
| `Content-Type` declarado no permitido | `fileFilter` | 415 | `"Unsupported file type"` |
| Sin archivo | `ImageFilePipe` | 400 | `"Image is required"` |
| Contenido real no es JPEG/PNG/WebP | `ImageFilePipe` (`file-type`) | 415 | `"Unsupported file type"` |

Detalles importantes:
- **El límite se aplica mientras llega el archivo**: Multer deja de leer al pasar 1 MB, en lugar de cargar en memoria un archivo de 50 MB para rechazarlo después. Por eso no se usa `MaxFileSizeValidator` como única defensa.
- **Los guards se ejecutan antes que los interceptors**: `JwtAuthGuard`, `RolesGuard` y el throttler rechazan la petición antes de que Multer lea el archivo. Un comprador o alguien sin token nunca llega a subir nada.
- **`fileFilter` no es suficiente**: el `mimetype` lo declara el cliente y se puede falsificar. `ImageFilePipe` comprueba que haya archivo y revisa los primeros bytes con `fileTypeFromBuffer` de `file-type`. Es la validación que cuenta.
- El tamaño de las peticiones JSON (body-parser) no cambia; Multer solo actúa en esta ruta.
- En los tests e2e se sube con supertest: `.attach('image', buffer, 'cafe.jpg')`.

### 7.3 Flujo de subida

1. Multer recibe el archivo en memoria con los límites de 7.2, y `ImageFilePipe` confirma que existe.
2. `ImageFilePipe` detecta el tipo real por los primeros bytes (*magic numbers*) con `file-type`. Si no es JPEG/PNG/WebP → 415. Los pipes se ejecutan antes que el método del controlador, por eso esta validación va antes que la del paso 3.
3. Se comprueba que el producto existe y es del vendedor (si no, 404), y que todavía no tiene 4 imágenes (si no, 409), **antes** de procesar la imagen, para no gastar CPU en vano. El paso 6 sigue siendo la garantía real del límite.
4. Se procesa con `sharp` (si no puede decodificar el archivo → 415 `"Unsupported file type"`; si pasa de 40 megapíxeles → 400 `"Image dimensions too large"`):
   - `rotate()` para respetar la orientación EXIF.
   - Imagen grande: máximo 1200 × 1200 px sin agrandar, WebP calidad 80.
   - Miniatura: 400 × 400 px, recorte centrado (`cover`), WebP calidad 75.
   - Se eliminan los metadatos (ubicación GPS, cámara, etc.). `sharp` lo hace por defecto al re-codificar.
   - `limitInputPixels: 40_000_000`.
5. Los dos buffers procesados se pasan a base64 (`data` y `thumbData`, con `mimeType: 'image/webp'`). No se escribe nada en disco y el nombre original del usuario nunca se usa. `url` y `thumbUrl` se arman con `PUBLIC_BASE_URL`, el id del producto y un id nuevo de imagen.
6. Se agrega al producto con una actualización condicional para que dos subidas simultáneas no pasen el límite:
   ```ts
   findOneAndUpdate(
     { _id, sellerId, 'images.3': { $exists: false } },
     { $push: { images: newImage } },
     { returnDocument: 'after' }, // `new: true` está obsoleto en Mongoose 9
   ).select(WITHOUT_IMAGE_DATA)
   ```
   Si no actualiza nada → 409 (o 404 si el producto se borró entretanto). No queda nada que limpiar: la imagen solo existía en memoria.

Re-codificar todas las imágenes tiene un efecto de seguridad: lo que se sirve siempre es un WebP generado por el servidor, nunca el archivo original del usuario.

### 7.4 Cómo se sirven

- Endpoint público dentro del prefijo de la API, **sin JWT** (una etiqueta `<img>` no puede enviar el header `Authorization`). Las imágenes de producto se consideran públicas:
  - `GET /products/:id/images/:imageId`: imagen grande.
  - `GET /products/:id/images/:imageId/thumb`: miniatura.
- Vive en su propio controlador (`ProductImagesController`, tag `Catalog` en Swagger), porque `CatalogController` exige token en todas sus rutas.
- Lee de MongoDB solo la versión pedida de esa imagen (agregación con `$unwind` + `$project`) y responde el binario.
- **Solo sirve imágenes de productos activos.** Un producto oculto o inexistente, o una imagen que no existe, responden 404 `"Image not found"`. Un id con formato inválido responde 400 `"Invalid id"`.
- Headers: `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable` (el id de una imagen nunca se reutiliza: una subida nueva es un id nuevo) y `X-Content-Type-Options: nosniff`.
- **Importante con helmet**: por defecto envía `Cross-Origin-Resource-Policy: same-origin`, que **bloquea** las imágenes cuando el frontend está en `localhost:5173`. Este endpoint responde `cross-origin`; el resto de la API mantiene `same-origin`.
- No cuenta para el límite global de peticiones (`@SkipThrottle`), igual que la ruta estática anterior: una página del catálogo pide hasta 48 miniaturas y la caché del navegador las conserva.
- Las URLs que devuelve la API son absolutas, construidas con `PUBLIC_BASE_URL`. El contrato no cambia: el frontend sigue usando `url` y `thumbUrl`.

### 7.5 Almacenamiento

Las imágenes se guardan **dentro del documento del producto**, en base64, en el subdocumento `ProductImage` (`data`, `thumbData` y `mimeType`). No hay archivos en disco, ni carpeta `uploads/`, ni `StorageService`.

Cabe de sobra en un documento: cada archivo de entrada pesa como máximo 1 MB, la versión WebP re-codificada suele pesar menos, y base64 le suma un 33 %. Con 4 imágenes (grande + miniatura), un producto queda en pocos MB, muy por debajo del límite de 16 MB de BSON (ver la decisión D19 del registro de implementación).

Borrar un producto (`deleteOne`) o una imagen (`$pull`) ya borra sus datos, en la misma operación. Reordenar reconstruye el arreglo dentro de MongoDB con un *update pipeline* (`$map` + `$filter` sobre los subdocumentos guardados), así que el base64 nunca viaja a Node.

## 8. Ajuste de stock

`POST /seller/products/:id/stock-adjustments`

```json
{ "type": "decrease", "quantity": 3 }
```

| Campo | Regla |
|---|---|
| `type` | `increase` (entrada) o `decrease` (salida) |
| `quantity` | Entero entre 1 y 100 000 |

Se hace en una sola operación atómica para que dos ajustes simultáneos no dejen stock negativo:

```ts
// salida
findOneAndUpdate(
  { _id, sellerId, stock: { $gte: quantity } },
  { $inc: { stock: -quantity } },
  { returnDocument: 'after' },
)
```

Si no se actualiza nada, se consulta `{ _id, sellerId }`: si no existe → 404; si existe → 409 `"Insufficient stock"`.

## 9. Descuentos

`PUT /seller/products/:id/discount`

```json
{ "percent": 15 }
```

- `percent`: entero entre 1 y 90. `DELETE /seller/products/:id/discount` lo deja en 0.
- `finalPrice = round(price × (100 − percent) / 100, 2)`, con las mitades hacia arriba y calculado en centavos (contrato §4.4). La fórmula vive en `pricing.ts`, en dos formas que hacen exactamente las mismas operaciones: `calculateFinalPrice` (JS, para tests y datos de prueba) y `finalPriceExpression` (expresión de agregación para el pipeline). Un test comprueba que dan lo mismo.
- No se usa `$round` de MongoDB: redondea las mitades al par y daría resultados distintos que JS (por ejemplo, 0,05 con 30 %: 0,04 en JS y 0,03 con `$round`).
- Cada vez que cambia `price` (en `PATCH`) o el descuento, `finalPrice` se recalcula **en la misma operación**, con un *update pipeline* de MongoDB, para que nunca queden desincronizados. Mongoose 9 exige `updatePipeline: true` para aceptar un pipeline:
  ```ts
  findOneAndUpdate(
    { _id, sellerId },
    [
      { $set: { discountPercent: percent } },
      { $set: { finalPrice: finalPriceExpression } },
    ],
    { returnDocument: 'after', updatePipeline: true },
  )
  ```
- `DELETE /discount` es idempotente: sin descuento previo responde 200 sin cambios.
- El descuento no tiene fecha de fin en esta versión: dura hasta que el vendedor lo quita.

## 10. Errores nuevos

Se mantiene el formato `ApiError`. Se agregan los siguientes (la lista completa, con los textos exactos de la interfaz, está en el contrato §6.2, que es el que manda):

| Código | Cuándo | `message` | Qué hace el frontend |
|---|---|---|---|
| 400 | Imagen de más de 40 megapíxeles | `"Image dimensions too large"` | "La imagen tiene demasiados píxeles. El máximo es 40 megapíxeles." |
| 400 | `imageIds` distinto de las imágenes actuales | `["imageIds must contain exactly the current image ids"]` | "Las imágenes cambiaron. Vuelve a intentarlo." y recarga el producto |
| 400 | Subida mal formada | `"Image is required"`, `"Unexpected file field - file"`, `"Too many files"`, `"Too many fields"` | "No se pudo subir la imagen." |
| 403 | Rol sin permiso (p. ej. comprador en `/seller/...`) | `"Forbidden"` | Redirige a la pantalla de inicio de su rol con "No tienes acceso a esa sección." |
| 404 | La imagen no existe (al borrarla, o en el endpoint público: también si el producto está oculto) | `"Image not found"` | "La imagen ya no existe." y recarga el producto. En una `<img>` no se muestra texto |
| 409 | Salida mayor al stock | `"Insufficient stock"` | "No hay suficiente stock para esa salida." en el diálogo |
| 409 | Ya hay 4 imágenes | `"Image limit reached"` | "Este producto ya tiene 4 imágenes." |
| 409 | SKU repetido **en el mismo vendedor** | `"SKU already exists"` | Igual que en 1.0 |
| 413 | Imagen de más de 1 MB | `"File too large"` | "La imagen pesa más de 1 MB." |
| 415 | Formato no permitido | `"Unsupported file type"` | "Formato no permitido. Usa JPG, PNG o WebP." |

Para distinguir los 409, el frontend usa la ruta del endpoint, igual que en 1.0.

## 11. Seguridad (adiciones)

1. `sellerId` sale siempre del token, nunca del body ni del query.
2. Todas las operaciones del vendedor filtran por `{ _id, sellerId }` en la misma consulta (no "buscar y luego comparar").
3. Validación del contenido real de las imágenes, re-codificación y límite de píxeles (sección 7).
4. Límite de peticiones específico para subida de imágenes: 20 por minuto por usuario.
5. El catálogo nunca devuelve datos privados del vendedor: solo `seller: { _id, name }` (sin email).
6. Búsqueda con texto escapado antes del `$regex`.

## 12. Cambios al contrato (1.1.0)

Estos tipos ya están en `api-contract.md` 1.1.0, que sigue siendo la fuente única de verdad. Se repiten aquí para leer la spec completa; si hay diferencias, manda el contrato.

```ts
// ---------- Usuarios ----------
export type UserRole = 'seller' | 'buyer';

export interface User {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

// ---------- Productos ----------
export interface ProductImage {
  _id: string;
  url: string;      // absoluta, máx. 1200 px
  thumbUrl: string; // absoluta, 400 px
  width: number;
  height: number;
}

export interface SellerSummary {
  _id: string;
  name: string;
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
  images: ProductImage[];  // images[0] = principal
  seller: SellerSummary;
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

export type UpdateProductRequest = Partial<Omit<CreateProductRequest, 'stock'>>;

export interface StockAdjustmentRequest {
  type: 'increase' | 'decrease';
  quantity: number;
}

export interface DiscountRequest {
  percent: number; // 1 a 90
}

export interface ReorderImagesRequest {
  imageIds: string[]; // deben ser exactamente los ids actuales, en el nuevo orden
}

export type SellerProductSortField = 'name' | 'price' | 'finalPrice' | 'stock' | 'createdAt';
export type CatalogSortField = 'createdAt' | 'finalPrice' | 'name' | 'discountPercent';

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

// LoginRequest, LoginResponse, PaginatedResponse, PaginationMeta, ApiError y SortOrder no cambian.
// SellerProductsQuery (contrato §3) es el query de 1.0 con sortBy: SellerProductSortField.
// UpdateProductRequest acepta además null en description y category para borrarlos (contrato §3).
```

Límites de peticiones (§8 del contrato): se agrega "Subida de imágenes, por usuario: 20 por minuto".

## 13. Frontend

### 13.1 Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/login`, `/register` | Igual que en 1.0, más el selector de rol en el registro | Pública |
| `/` | Redirige según el rol: `seller` → `/seller/products`, `buyer` → `/catalog` | Protegida |
| `/catalog` | Catálogo en tarjetas | Solo `buyer` |
| `/catalog/:id` | Detalle con galería | Solo `buyer` |
| `/seller/products` | Gestión de mis productos (la tabla de 1.0 ampliada) | Solo `seller` |
| `*` | No encontrada | Pública |

- `ProtectedRoute` recibe `roles?: UserRole[]`. Con rol incorrecto redirige a la pantalla de inicio del rol del usuario y muestra "No tienes acceso a esa sección".
- Después del login también se redirige según el rol.
- La barra superior muestra enlaces según el rol: el vendedor solo ve "Mis productos" y el comprador solo "Catálogo".
- **El vendedor no usa el catálogo**: solo crea y gestiona sus productos, y su pantalla de inicio es "Mis productos" (`/seller/products`), igual después del login. Si escribe `/catalog` o `/catalog/:id`, termina en `/seller/products` con "No tienes acceso a esa sección.". Es una regla de la interfaz: la API (`GET /products`) sigue aceptando a cualquier usuario autenticado, porque el catálogo solo muestra datos públicos.

### 13.2 Registro

Selector de rol con dos tarjetas seleccionables (`RadioGroup` de Headless UI): **"Quiero comprar"** y **"Quiero vender"**, cada una con una línea de descripción. Es obligatorio; no hay opción preseleccionada para que la elección sea consciente.

### 13.3 Estado (Redux)

| Slice | Cambios |
|---|---|
| `authSlice` | `user.role`. Selectores `selectRole` y `selectHomePath`. |
| `sellerProductsSlice` | Renombrado desde `productsSlice`. Nuevos thunks: `adjustStock`, `setDiscount`, `removeDiscount`, `toggleActive`, `uploadImage`, `deleteImage`, `reorderImages`. Estos reemplazan el producto en `items` con la respuesta, sin volver a pedir la lista. Crear y eliminar siguen recargando la página actual (como en 1.0). |
| `catalogSlice` | Nuevo. Estado: `items`, `meta`, `categories`, `selected` (detalle), `status`, `error`. Thunks: `fetchCatalog`, `fetchCategories`, `fetchCatalogProduct`. |
| `uiSlice` | Sin cambios. |

**Filtros del catálogo en la URL**: los filtros viven en los query params (`/catalog?category=Café&onSale=true&page=2`). Así se pueden compartir, sobreviven a la recarga y funciona el botón "atrás". El flujo va en una sola dirección: la URL es la fuente de verdad → se parsea con `parseCatalogQuery()` → se hace `dispatch(fetchCatalog(query))`. Los componentes cambian filtros escribiendo en la URL (`setSearchParams`), no en Redux.

**Progreso de subida**: el porcentaje de cada archivo es estado local del componente. El thunk `uploadImage` recibe un callback `onProgress` que se pasa al `onUploadProgress` de axios. Como las funciones no son serializables, en `configureStore` se agrega `ignoredActionPaths: ['meta.arg.onProgress']` al `serializableCheck`. El `File` que recibe el thunk tampoco es serializable, así que la lista completa es `['meta.arg.onProgress', 'meta.arg.file']`.

**Multipart**: en `productsApi.uploadImage` no se fija el `Content-Type` a mano; axios lo pone con el `boundary` correcto al recibir un `FormData`.

### 13.4 Vista del vendedor (`/seller/products`)

Parte de la tabla de 1.0 y agrega:

| Columna | Contenido |
|---|---|
| Imagen | Miniatura de 40 px (`thumbUrl` de la principal) o un icono gris si no tiene. |
| Nombre / SKU / Categoría | Igual que en 1.0. |
| Precio | Si hay descuento: precio final, debajo el precio de lista tachado y la etiqueta `-15%`. |
| Stock | Número y etiqueta "Stock bajo" (≤ 5) o "Agotado" (0). |
| Estado | Interruptor (`Switch` de Headless UI) "Visible / Oculto". Cambia `isActive` al instante. |
| Acciones | Menú "⋯" (`Menu` de Headless UI): Editar, Imágenes, Ajustar stock, Descuento, Eliminar. |

**Diálogo "Ajustar stock"**
- Control segmentado **Entrada / Salida**, campo de cantidad y vista previa: "Stock actual 40 → 45".
- En salida, el cliente no deja pasar una cantidad mayor al stock actual; si el backend responde 409 (otra persona vendió entre medio), se muestra el error en el diálogo y se actualiza el stock mostrado.
- Notificación: "Stock actualizado".

**Diálogo "Descuento"**
- Campo de porcentaje (1–90) con vista previa en vivo: "$145.000 → $123.250 (-15 %)". La vista previa es orientativa; el valor oficial es el `finalPrice` que devuelve el backend.
- Botones "Guardar" y, si ya tiene descuento, "Quitar descuento".

**Diálogo "Imágenes"**
- Cuadrícula con las imágenes actuales y el contador "3 de 4". La primera lleva la etiqueta "Principal".
- Por imagen: "Eliminar" (con confirmación). **No hay "Hacer principal"**: la principal es la primera en orden de subida, y como las tarjetas del catálogo rotan todas las imágenes (sección 13.5), elegirla no hace falta. La etiqueta "Principal" se mantiene en la primera, porque es la que se ve en la tabla del vendedor, al empezar la rotación y en el detalle.
- Zona para arrastrar y soltar más un botón "Elegir archivos" (`<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`). Se pueden elegir varias; se suben **una por una** con barra de progreso individual.
- Validación en el cliente antes de subir (misma regla que el backend): "foto.png pesa 2,3 MB. El máximo es 1 MB." / "documento.pdf no es una imagen válida. Usa JPG, PNG o WebP." Los archivos rechazados no se envían; los demás sí.
- La zona de carga se desactiva al llegar a 4 imágenes.

**Formulario de crear/editar**
- Al crear se pide el stock inicial. Al editar, el stock se muestra solo como lectura, con un enlace "Ajustar stock".
- Después de crear un producto se abre automáticamente el diálogo de imágenes con el mensaje "Producto creado. Ahora agrega sus imágenes." (no se pueden subir antes porque el producto todavía no tiene `_id`).
- Editar un producto reemplaza la fila con la respuesta del backend, como las demás acciones de la fila. Crear y eliminar recargan la página actual (sección 13.3).

En móvil, las tarjetas de `ProductCardList` muestran la miniatura, el precio con descuento, las etiquetas de stock y el mismo menú de acciones.

### 13.5 Vista del comprador (`/catalog`)

**Estructura**
- Escritorio (`lg:`): panel de filtros fijo a la izquierda (`w-64`) y grilla a la derecha.
- Móvil y tablet: botón "Filtros (2)" (el número indica los filtros activos) que abre un panel lateral (`Dialog` de Headless UI), con "Aplicar" y "Limpiar".
- Encima de la grilla: buscador (con la misma espera de 400 ms de 1.0), selector de orden, total ("42 productos") y chips de los filtros activos, cada uno con una ✕ para quitarlo, y "Limpiar filtros".

**Filtros**

| Filtro | Control |
|---|---|
| Categoría | Lista de opciones desde `GET /products/categories`, más "Todas" |
| Precio | Dos campos (mínimo / máximo). Se aplican al pulsar "Aplicar" o al salir del campo, no en cada tecla. |
| Solo con descuento | Casilla |
| Solo disponibles | Casilla |
| Ordenar | Más recientes · Menor precio · Mayor precio · Nombre A–Z · Mayor descuento |

Cualquier cambio de filtro vuelve a la página 1.

**Tarjeta de producto (`ProductCard`)**
- Imagen cuadrada (`aspect-square object-cover`) con `thumbUrl`, `loading="lazy"`, `alt` con el nombre del producto. Si no tiene imagen, se muestra un fondo `bg-navy-50` con un icono.
- **Imágenes que rotan**: si el producto tiene más de una imagen, la tarjeta las va mostrando una tras otra, empezando por `images[0]`, cada 3 segundos (`CARD_IMAGE_ROTATION_MS`), con un fundido (`transition-opacity`) y vuelve a la primera después de la última. Unos puntos abajo indican cuál se está viendo.
  - La rotación se pausa mientras el puntero o el foco están sobre la tarjeta.
  - No rota si el usuario tiene activado "reducir movimiento" (`prefers-reduced-motion`): se queda en la primera.
  - Solo la imagen visible tiene `alt`; las demás son copias decorativas (`alt=""`, `aria-hidden`), para que un lector de pantalla no repita el nombre.
  - La lógica vive en el hook `features/catalog/useRotatingIndex.ts`.
- Etiqueta `-15%` arriba a la izquierda cuando hay descuento.
- Si `stock = 0`: capa semitransparente "Agotado" sobre la imagen (la tarjeta sigue visible, salvo que esté activo el filtro "Solo disponibles").
- Nombre (máximo 2 líneas, `line-clamp-2`), categoría y "por {nombre del vendedor}".
- Precio final destacado y, si hay descuento, el precio de lista tachado al lado.
- Toda la tarjeta es un enlace a `/catalog/:id`, con foco visible.

**Grilla**: `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` y `gap-3 md:gap-4`. Paginación numerada con el componente de 1.0, con tamaños 12, 24 y 48.

**Estados**

| Estado | Qué se muestra |
|---|---|
| Cargando por primera vez | Tarjetas esqueleto |
| Recargando | La grilla actual con opacidad reducida y un indicador, sin parpadeo |
| Sin resultados con filtros | "No encontramos productos con esos filtros" y botón "Limpiar filtros" |
| Catálogo vacío | "Todavía no hay productos publicados" |
| Error | Mensaje amigable y "Reintentar" |

### 13.6 Detalle (`/catalog/:id`)

- Galería: imagen principal grande (`url`, con `width`/`height` para reservar el espacio) y miniaturas debajo. Las miniaturas se pueden elegir con clic o con teclado (flechas).
- Nombre, vendedor, categoría, precio (con descuento si aplica) y disponibilidad: "Disponible · 12 unidades" o "Agotado".
- Descripción completa.
- Enlace "← Volver al catálogo" que conserva los filtros (`navigate(-1)` si se llegó desde el catálogo; si no, `/catalog`).
- 404 → "Este producto ya no está disponible" y enlace al catálogo.
- No hay botón "Comprar" en esta versión (carrito y órdenes quedan para la spec 04).

### 13.7 Tema (adiciones a la sección 14 de la spec 02)

| Elemento | Clases | Nota de contraste |
|---|---|---|
| Etiqueta de descuento | `bg-red-600 text-white text-xs font-semibold rounded-md px-2` | 4.8:1 ✅ |
| Precio tachado | `text-navy-400 line-through text-sm` | 6.1:1 ✅ (`navy-300` no cumple: 3.1:1) |
| Precio final | `text-navy-500 font-semibold` | 13.0:1 ✅ |
| "Agotado" sobre imagen | `bg-navy-500/80 text-white` | Sobre fondo oscuro ✅ |
| Stock bajo | `bg-amber-100 text-amber-800` | 6.4:1 ✅ |
| Tarjeta de producto | `bg-white border border-navy-100 rounded-xl shadow-sm hover:shadow-md transition-shadow` | — |
| Zona de carga | `border-2 border-dashed border-navy-200 rounded-xl`; al arrastrar encima `border-brand-500 bg-brand-50` | — |

### 13.8 Utilidades nuevas

- `utils/imageValidation.ts`: `validateImageFile(file)` → `{ ok: true } | { ok: false, message }`. Comparte la constante `MAX_IMAGE_BYTES = 1_048_576` y los tipos permitidos.
- `utils/catalogQuery.ts`: `parseCatalogQuery(searchParams)` y `toSearchParams(query)`. Ignora valores inválidos en lugar de romper (p. ej. `?page=abc` → página 1).
- `utils/formatters.ts`: se agregan `formatPercent` y `formatFileSize` ("2,3 MB").

## 14. Base de datos y datos de prueba

**Se parte de una base vacía (sin migración).** Es una prueba técnica y los datos de 1.0 no tienen valor, así que antes de arrancar la 1.1 se borra la base:

```bash
mongosh productos_db --eval "db.dropDatabase()"
```

Si `mongosh` no está instalado, `npm run seed` sirve igual: borra las colecciones `users` y `products` y vuelve a crear sus índices.

Con eso desaparece también el índice único viejo de `sku`. Mongoose crea los índices nuevos al arrancar (`autoIndex` activo en desarrollo). En producción se desactivaría `autoIndex` y los índices se crearían con un script.

Como no hay datos viejos, los campos nuevos pueden ser obligatorios desde el principio: `role` en usuarios y `sellerId` en productos, sin valores por defecto ni casos especiales para documentos incompletos.

**Datos de prueba (`npm run seed`)**. Antes de insertar, limpia las colecciones `users` y `products` (las imágenes viven dentro de los productos), así que se puede ejecutar varias veces y siempre deja el mismo estado.
- 2 vendedores, 1 comprador (credenciales en el README).
- 30 productos repartidos en varias categorías, algunos con descuento, algunos agotados y algunos ocultos.
- Imágenes de ejemplo propias o de libre uso, incluidas en base64 dentro de cada producto de `backend/seed/products.json` (`mimeType`, `data`, `thumbData`, `width`, `height`), ya procesadas a WebP con el mismo servicio de imágenes de la app. El seed solo agrega `_id`, `url` y `thumbUrl` y las guarda dentro de cada producto. Nunca más de 4 por producto.
- El script vive en `src/scripts/seed.ts` (no en `backend/scripts/`): necesita los servicios de Nest, que usan decoradores, y solo `src/` se compila. Se ejecuta con `nest build && node dist/scripts/seed.js`, igual que `docs:export`.

## 15. Configuración

Backend (`.env.example`), se agrega:
```
PUBLIC_BASE_URL=http://localhost:3000
```

Es obligatoria y se valida al arrancar, igual que las demás. Debe ser una URL con protocolo. (`UPLOADS_DIR` existió mientras las imágenes se guardaban en disco; ya no se usa.)

Frontend (`.env.example`):
```
VITE_API_URL=http://localhost:3000/api/v1
```

## 16. Estructura de carpetas (solo lo nuevo o cambiado)

```
backend/
├── seed/products.json            # productos con sus imágenes en base64
└── src/
    ├── scripts/
    │   └── seed.ts                   # junto a export-openapi.ts (ver sección 14)
    ├── common/
    │   ├── decorators/roles.decorator.ts
    │   ├── guards/roles.guard.ts
    │   ├── guards/user-throttler.guard.ts
    │   └── utils/escape-regexp.ts    # lo usa search-regex.util.ts (1.0)
    └── modules/
        ├── images/
        │   ├── multer.config.ts              # límites y fileFilter de Multer
        │   ├── image-file.pipe.ts            # archivo obligatorio + magic numbers
        │   └── image-processing.service.ts   # sharp
        └── products/
            ├── catalog.controller.ts         # /products
            ├── product-images.controller.ts  # /products/:id/images/:imageId (público)
            ├── image-urls.ts                 # url y thumbUrl con PUBLIC_BASE_URL
            ├── seller-products.controller.ts # /seller/products
            ├── products.service.ts
            ├── pricing.ts                    # calculateFinalPrice
            ├── dto/
            │   ├── catalog-query.dto.ts
            │   ├── stock-adjustment.dto.ts
            │   ├── discount.dto.ts
            │   └── reorder-images.dto.ts
            └── schemas/product-image.schema.ts

frontend/src/
├── features/
│   ├── seller/                   # antes features/products
│   │   ├── sellerProductsSlice.ts
│   │   ├── SellerProductsPage.tsx
│   │   └── components/
│   │       ├── ProductTable.tsx
│   │       ├── ProductCardList.tsx
│   │       ├── ProductFormDialog.tsx
│   │       ├── DeleteProductDialog.tsx
│   │       ├── StockAdjustDialog.tsx
│   │       ├── DiscountDialog.tsx
│   │       ├── ProductImagesDialog.tsx
│   │       ├── ImageDropzone.tsx
│   │       └── ProductActionsMenu.tsx
│   └── catalog/
│       ├── catalogSlice.ts
│       ├── CatalogPage.tsx
│       ├── ProductDetailPage.tsx
│       └── components/
│           ├── ProductCard.tsx
│           ├── ProductGrid.tsx
│           ├── CatalogFilters.tsx
│           ├── FiltersDrawer.tsx      # móvil
│           ├── ActiveFilterChips.tsx
│           └── ImageGallery.tsx
├── components/
│   ├── PriceTag.tsx              # precio final + tachado + etiqueta, lo usan ambas vistas
│   └── Pagination.tsx            # extraído de la tabla de 1.0 para reutilizarlo
└── utils/
    ├── imageValidation.ts
    └── catalogQuery.ts
```

## 17. Criterios de aceptación

**Roles**
- [ ] Registrarse sin `role` o con un valor distinto de `seller`/`buyer` devuelve 400.
- [ ] `GET /auth/me` incluye `role`.
- [ ] Un comprador que llama a cualquier `/seller/...` recibe 403.
- [ ] Un vendedor que intenta ver, editar, ajustar o subir imágenes a un producto de otro vendedor recibe 404.
- [ ] Enviar `sellerId` en el body de crear o editar devuelve 400.

**Productos del vendedor**
- [ ] `GET /seller/products` devuelve solo los productos del vendedor, incluidos los ocultos.
- [ ] Dos vendedores pueden crear productos con el mismo SKU; el mismo vendedor no (409).
- [ ] `PATCH` con `stock` devuelve 400.
- [ ] Una salida mayor al stock devuelve 409 y el stock no cambia.
- [ ] Diez salidas simultáneas de 1 unidad sobre un stock de 5 dejan el stock en 0, nunca negativo (test de concurrencia).
- [ ] Aplicar 15 % a un producto de 145 000 devuelve `finalPrice: 123250`.
- [ ] Cambiar el precio de un producto con descuento recalcula `finalPrice`.
- [ ] Un descuento de 0 o de 91 devuelve 400.

**Imágenes**
- [ ] Subir un JPEG de 900 KB devuelve 201 y el producto con `url` y `thumbUrl` que cargan en el navegador desde `localhost:5173`, sin token.
- [ ] Subir un archivo de 1 048 577 bytes devuelve 413.
- [ ] Subir un `.txt` renombrado a `.png` devuelve 415.
- [ ] La quinta imagen devuelve 409.
- [ ] Sin archivo devuelve 400 `"Image is required"`; con el campo llamado `file` en lugar de `image`, 400 `"Unexpected file field - file"`; con dos archivos, 400.
- [ ] Un comprador o una petición sin token que sube una imagen recibe 403/401 sin que Multer llegue a leer el archivo.
- [ ] En Swagger, el endpoint de subida muestra un selector de archivo y se puede probar desde ahí.
- [ ] Las imágenes guardadas son WebP y no conservan metadatos EXIF.
- [ ] Las imágenes se guardan en base64 dentro del producto, y ningún listado ni detalle devuelve ese base64.
- [ ] La imagen de un producto oculto, o una imagen inexistente, responde 404.
- [ ] Eliminar un producto o una imagen borra sus datos: sus URLs responden 404.

**Catálogo**
- [ ] `GET /products` no devuelve productos ocultos, y su detalle responde 404.
- [ ] `minPrice` y `maxPrice` filtran por precio final; `minPrice > maxPrice` devuelve 400.
- [ ] `onSale=false` no filtra (no se interpreta como `true`).
- [ ] La respuesta del catálogo incluye `seller.name` y no incluye el email del vendedor.
- [ ] `search=.*` no rompe la consulta y busca el texto literal.

**Frontend**
- [ ] El login del vendedor lleva a `/seller/products`; el del comprador, a `/catalog`.
- [ ] Un comprador que escribe `/seller/products` en la URL termina en `/catalog` con aviso.
- [ ] Un vendedor que escribe `/catalog` o `/catalog/:id` termina en `/seller/products` con aviso, y su barra superior solo muestra "Mis productos".
- [ ] Ajustar stock, aplicar descuento, ocultar y subir imágenes actualizan la fila sin recargar toda la tabla.
- [ ] Elegir una imagen de 2 MB muestra el error sin hacer ninguna petición.
- [ ] La subida muestra una barra de progreso por archivo.
- [ ] Los filtros del catálogo se reflejan en la URL; al recargar o compartir el enlace se ven los mismos resultados.
- [ ] A 360 px el catálogo muestra 2 columnas y los filtros en un panel lateral; a 1280 px, el panel de filtros fijo y 4 columnas.
- [ ] Las tarjetas de productos agotados muestran "Agotado".
- [ ] En el catálogo, una tarjeta con varias imágenes las va rotando cada 3 segundos; se pausa con el puntero o el foco encima y no rota con "reducir movimiento".
- [ ] El diálogo "Imágenes" del vendedor no ofrece "Hacer principal".
- [ ] Redux DevTools muestra `pending/fulfilled/rejected` de los thunks nuevos.

**Calidad**
- [ ] `docs/openapi.json` refleja la versión 1.1.0 (`info.version: "1.1.0"`), incluido el `multipart/form-data` de imágenes (`@ApiConsumes` + `@ApiBody`).
- [ ] `api-contract.md` actualizado a 1.1.0.
- [ ] Con la base vacía, `npm run seed` crea los usuarios y productos de prueba con imágenes, y se puede repetir sin duplicar nada.
- [ ] Tests, lint y build sin errores en backend y frontend.

## 18. Tareas de implementación

Como en las specs anteriores, cada tarea se pide por separado y se valida antes de pasar a la siguiente.

**Backend**
1. Versión `1.1.0` en Swagger (el prefijo `/api/v1` no cambia). Agregar `role` al schema de usuario, a los DTOs y al payload del JWT.
2. `@Roles` + `RolesGuard`, con sus tests.
3. Cambios al schema de producto (`sellerId`, `discountPercent`, `finalPrice`, `images`) e índices nuevos.
4. Dividir en `CatalogController` y `SellerProductsController`. Filtrar todas las operaciones del vendedor por `sellerId`.
5. Query del catálogo: filtros, booleanos bien convertidos, búsqueda escapada y `GET /products/categories`.
6. Ajuste de stock atómico, y quitar `stock` del `UpdateProductDto`.
7. `calculateFinalPrice`, endpoints de descuento y recálculo en `PATCH` con *update pipeline*.
8. `StorageService` + `LocalDiskStorage`, ruta estática `/uploads` con los headers correctos (incluido CORP en helmet). *Reemplazada después por el almacenamiento en MongoDB y el endpoint público de la sección 7.4 (decisión D19).*
9. Imágenes: `multer.config.ts` (sección 7.2), `ImageFilePipe`, `ImageProcessingService` (sharp) y endpoints de subir, eliminar y reordenar, con su documentación `multipart` en Swagger. Límite de 20 por minuto. Instalar `@types/multer` como dependencia de desarrollo.
10. Script de datos de prueba (`npm run seed`). Documentar en el README que se parte de una base vacía.
11. Tests: guard de roles, stock (incluida la concurrencia), precio final, validación de imágenes. Los que necesitan MongoDB real (concurrencia del stock, `$push` condicional, subida de archivos) van en la suite e2e (`npm run test:e2e`), que también se actualiza a la 1.1.0.
12. Swagger (tags `Auth`, `Catalog`, `Seller products`), exportar `openapi.json` y actualizar `api-contract.md`.

**Frontend**
13. Actualizar `types/`, `VITE_API_URL` y la API (`catalogApi.ts`, cambios en `productsApi.ts`).
14. `authSlice` con rol, `ProtectedRoute` con `roles`, redirección por rol y selector de rol en el registro.
15. Renombrar a `features/seller`. Extraer `Pagination` y `PriceTag`. Columnas nuevas y menú de acciones.
16. `StockAdjustDialog`, `DiscountDialog` e interruptor de visibilidad.
17. `ProductImagesDialog` + `ImageDropzone` con validación, progreso y reordenamiento. Abrirlo después de crear. *Después se quitó "Hacer principal" y se agregó la rotación de imágenes en las tarjetas del catálogo (secciones 13.4 y 13.5).*
18. `catalogSlice`, `catalogQuery.ts` y `CatalogPage` con grilla y tarjetas.
19. Filtros: panel de escritorio, panel lateral en móvil y chips de filtros activos.
20. `ProductDetailPage` con galería.
21. Estados de carga, vacío y error del catálogo; ajustes responsive.
22. Tests: `catalogSlice`, `parseCatalogQuery`, `validateImageFile` y thunks nuevos de `sellerProductsSlice`.
23. README de ambos proyectos: roles, credenciales de prueba, cómo reiniciar la base y capturas nuevas.

## 19. Decisiones abiertas (para revisar)

- **1.1.0 en lugar de 2.0.0**: según la regla general del contrato, estos cambios serían una versión mayor con un prefijo nuevo (`/api/v2`), porque `role` pasa a ser obligatorio, cambian rutas y el stock deja de editarse con `PATCH`. Se deja como 1.1.0 en `/api/v1` porque la API no tiene clientes externos, el frontend se actualiza a la vez y la base se borra. Es una excepción documentada (contrato §9), no la norma: en producción sería 2.0.0 y las dos versiones convivirían un tiempo.
- **Sin migración de datos**: se borra la base porque es una prueba. En producción haría falta un script que asigne rol a los usuarios existentes y dueño a los productos, rellene `discountPercent`, `finalPrice` e `images`, y cambie el índice único de `sku` por `{ sellerId, sku }`.
- **Catálogo con sesión obligatoria**: se mantiene la decisión de la spec 01 (todo protegido). Lo más común en una tienda es que el catálogo sea público y la sesión se pida solo al comprar. Cambiarlo es sencillo: quitar el guard de `CatalogController`.
- **404 en lugar de 403 para productos ajenos**: no revela si el producto existe y simplifica las consultas. La desventaja es que el mensaje es menos explícito al depurar.
- **Imágenes en base64 dentro de MongoDB**: no hay archivos que sincronizar ni que limpiar, el borrado es atómico y funciona igual en un contenedor sin disco persistente. Cabe porque cada imagen pesa como máximo 1 MB y hay 4 por producto (muy por debajo de los 16 MB de BSON). El costo: base64 ocupa un 33 % más, cada imagen pasa por Node y por la base, y no hay CDN. Con imágenes más grandes o más tráfico se usaría S3/Cloudinary (decisión D19).
- **Imágenes públicas sin token**: necesario para usar `<img>` directamente. Si algún día hubiera imágenes privadas, se usarían URLs firmadas con vencimiento.
- **Una imagen por petición**: simplifica la validación, los errores por archivo y la barra de progreso. Subir 4 imágenes son 4 peticiones (cabe de sobra en el límite de 20 por minuto).
- **Stock solo por ajustes, sin historial**: el siguiente paso natural es una colección `stock_movements` (quién, cuándo, tipo, cantidad, motivo) para tener auditoría.
- **Descuento sin fechas**: agregar `discountEndsAt` obliga a calcular el precio final al consultar (o a un proceso programado que lo limpie), porque el `finalPrice` guardado quedaría desactualizado al vencer.
- **Rol fijo y único**: un usuario no puede ser vendedor y comprador a la vez. Si se necesitara, `role` pasaría a ser `roles: UserRole[]`.
- **Rotación automática en lugar de elegir la principal**: el comprador ve todas las imágenes sin entrar al detalle y el vendedor no tiene que decidir cuál va primero. Se pausa con el puntero o el foco, y no rota con "reducir movimiento", para no molestar ni marear. El endpoint de orden se conserva en la API (quitarlo sería un cambio incompatible del contrato) y se podría volver a usar si se quisiera elegir el orden.
- **Paginación numerada en el catálogo**: se reutiliza el componente de la tabla. "Cargar más" o el scroll infinito son habituales en tiendas, pero complican el estado y la sincronización con la URL.
