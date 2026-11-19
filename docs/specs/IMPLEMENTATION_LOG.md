# Registro de implementación – Spec 03 (contrato 1.1.0)

Registro de la implementación de `03-mejoras-roles-vendedor-comprador.md` siguiendo `instructivo.md`: cambios a los documentos, decisiones tomadas por cuenta propia y una entrada por tarea.

Rama: `feat/spec-03-vendedores-compradores`.

## Decisiones

Decisiones sobre puntos que los documentos no definían o en los que se contradecían. Cada una ya está reflejada en el contrato o en la spec 03.

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| D1 | Redondeo de `finalPrice` | Se calcula en centavos enteros con las mitades hacia arriba: `floor((round(price × 100) × (100 − d) + 50) / 100) / 100`. La misma fórmula existe en JS (`calculateFinalPrice`) y como expresión de agregación (`finalPriceExpression`). | `$round` de MongoDB redondea las mitades al par y la fórmula de la spec (`price × (1 − d/100)`) no coincidía con la de JS: con 0,05 y 30 % daban 0,04 y 0,03. Con enteros las dos dan siempre el mismo resultado. Se mantiene `price` con 2 decimales, como dice el contrato. |
| D2 | `null` en `PATCH` | Se mantiene el comportamiento de la 1.0: `null` en `description` o `category` borra el campo; en campos obligatorios responde 400. Se documenta en el contrato. | El formulario de edición del frontend ya lo usa para vaciar esos campos y el contrato no lo mencionaba. |
| D3 | Mensaje de campo con otro nombre | `"Unexpected file field - file"` en lugar de `"Unexpected field"`. | Es lo que devuelve Multer 2.5 a través de Nest 12.5 (comprobado con una prueba real). El instructivo prohíbe tocar el filtro global para reescribir mensajes, así que se ajustan los documentos. |
| D4 | Imagen que pasa los *magic numbers* pero no se puede decodificar | 415 `"Unsupported file type"`. | No es un JPEG/PNG/WebP válido; se reutiliza un error existente en lugar de inventar uno nuevo. |
| D5 | Orden de las comprobaciones al subir | 429 por IP → 401 → 403 → 429 por usuario → Multer → `Invalid id` → `Image is required` → 415 por contenido → 404 → 409 → 400 por resolución. | Es el orden real de Nest (guards → interceptors → pipes → método). Se agrega una comprobación previa del conteo (409) antes de procesar con `sharp`, para no gastar CPU; el `$push` condicional sigue siendo la garantía. |
| D6 | Reordenar imágenes | `imageIds`: ObjectIds únicos, máximo 5. Si no coinciden exactamente con las actuales → 400 `["imageIds must contain exactly the current image ids"]`. `[]` es válido solo sin imágenes. La actualización es condicional (`$size` + `$all`), así que una subida o un borrado simultáneos hacen fallar la comparación con 400. | El contrato no definía el mensaje, el arreglo vacío ni la concurrencia. |
| D7 | Límite de subida por usuario | `UserThrottlerGuard` (subclase de `ThrottlerGuard` con `getTracker` = id del usuario) en la ruta, después de `JwtAuthGuard` y `RolesGuard`. El `@Throttle` de la ruta hace que el guard global también cuente 20 por IP. | El guard global corre antes de la autenticación y no conoce al usuario. |
| D8 | Búsqueda | Se conserva `buildSearchRegex` de la 1.0 (escapa el texto y además ignora tildes). Se agrega `common/utils/escape-regexp.ts` como pide la spec §16 y `buildSearchRegex` lo usa. | El criterio de la spec 01 (`cafe` encuentra `Café`) depende de ignorar tildes; quitarlo sería una regresión. |
| D9 | Booleanos del query | `@Transform(({ value }) => value === 'true')`, exactamente como pide la spec: cualquier otro valor cuenta como `false`. | Es la regla obligatoria del instructivo; se documenta en el contrato. |
| D10 | `category` | Hasta 50 caracteres, coincidencia exacta. `/products/categories` ordena con collation `es` y omite los productos sin categoría. | El contrato no fijaba límite ni orden. 50 es el máximo del campo al crear. |
| D11 | Script de datos de prueba | `src/scripts/seed.ts` en lugar de `backend/scripts/seed.ts`. Se ejecuta con `nest build && node dist/scripts/seed.js`. | Solo `src/` se compila y el script necesita servicios de Nest con decoradores, que Node no ejecuta sin compilar. Es el mismo patrón de `docs:export`. |
| D12 | `ignoredActionPaths` | `['meta.arg.onProgress', 'meta.arg.file']`. | El `File` que recibe `uploadImage` tampoco es serializable y daría avisos en desarrollo. Se mantiene el valor exigido y se agrega el del archivo. |
| D13 | Variables nuevas | `PUBLIC_BASE_URL` (URL con protocolo) y `UPLOADS_DIR` son obligatorias y se validan al arrancar. | La spec no decía si eran opcionales; las URLs de las imágenes dependen de ellas. |
| D14 | Editar un producto en el frontend | Reemplaza la fila con la respuesta, igual que el resto de acciones de la fila. Crear y eliminar recargan la página. | La spec 03 solo hablaba de crear y eliminar. |
| D15 | `DELETE /discount` sin descuento | 200 sin cambios (idempotente). | No estaba definido. |
| D16 | Límites de peticiones | Se documenta que el throttler cuenta por endpoint (la clave incluye controlador y método). | Es el comportamiento de `@nestjs/throttler`; el contrato hablaba de un límite "global". |
| D17 | Tests que necesitan MongoDB | Concurrencia del stock, `$push` condicional y subida real de archivos van en `npm run test:e2e`, que se actualiza a la 1.1.0. En cada tarea del backend se ejecuta también la suite e2e. | Los tests unitarios usan mocks del modelo y no pueden probar atomicidad. La suite e2e de la 1.0 se rompería en silencio si nadie la actualiza. |
| D18 | Borrar la base sin `mongosh` | `mongosh` no está instalado en esta máquina. El seed borra las colecciones y recrea los índices, así que sirve para reiniciar. | Requisito de la fase 2. |
| D19 | Imágenes en base64 dentro de MongoDB, máximo 4 por producto | Reemplaza a `LocalDiskStorage`, la ruta estática `/uploads` y `UPLOADS_DIR`. Multer, `ImageFilePipe` y `sharp` no cambian; los dos WebP procesados se guardan en base64 en `ProductImage` (`data`, `thumbData`, `mimeType`, con `select: false` en los datos). Todas las consultas de productos excluyen el base64 con la proyección `WITHOUT_IMAGE_DATA`, y reordenar reconstruye el arreglo dentro de MongoDB (*update pipeline*) para no traerlo a Node. `url` y `thumbUrl` apuntan a `GET /products/:id/images/:imageId` (y `/thumb`): público, solo productos activos (oculto o inexistente → 404 `"Image not found"`), con caché `immutable`, `nosniff` y CORP `cross-origin`, y sin límite de peticiones (`@SkipThrottle`), como la ruta estática que reemplaza. El límite baja a 4 con `'images.3': { $exists: false }`. El contrato sigue en 1.1.0. | Cada archivo de entrada pesa como máximo 1 MB (el WebP re-codificado suele pesar menos) y base64 le suma un 33 %: con 4 imágenes y sus miniaturas, un producto queda muy por debajo del límite de 16 MB de un documento BSON. A cambio, no hay archivos que sincronizar ni huérfanos que limpiar (borrar un producto o una imagen borra sus datos en la misma operación) y funciona igual en un contenedor sin disco persistente. Bajar a 4 deja más margen. Se mantiene 1.1.0 porque los tipos del contrato no cambian, el frontend no se toca y sigue siendo una prueba técnica (excepción de la regla 9); con clientes externos, el endpoint nuevo sería una 1.2.0. |

## Fase 0 – Cambios a los documentos

| Documento y sección | Qué decía | Qué dice ahora | Por qué |
|---|---|---|---|
| Contrato §3 `UpdateProductRequest` | `Partial<Omit<CreateProductRequest, 'stock'>>` | Igual, pero `description` y `category` aceptan `null` | D2 |
| Contrato §4.2 | Nada sobre `null` | `null` borra `description`/`category`; en campos obligatorios, 400 | D2 |
| Contrato §4.4 | `round(…, 2)` sin más detalle | Redondeo en centavos, mitades hacia arriba, con la fórmula exacta. `DELETE /discount` idempotente | D1, D15 |
| Contrato §4.5 | `"Unexpected field"`; sin mensaje de resolución; sin reglas de `imageIds` vacío ni concurrencia | `"Unexpected file field - <campo>"`, `"Too many fields"`, `"Image dimensions too large"`, 415 si no se puede decodificar, orden de las comprobaciones y reglas completas de `imageIds` | D3–D6 |
| Contrato §4.6 | `search` sin tildes no mencionado; `category` sin límite; booleanos solo `true`/`false` | Tampoco distingue tildes; `category` ≤ 50 y exacta; otro valor cuenta como `false` | D8–D10 |
| Contrato §4.7 | Nada sobre `/products/categories` | Orden con collation `es`, sin productos sin categoría | D10 |
| Contrato §5.3 | `?category=Café` | `?category=Caf%C3%A9` con una nota | Una petición real lleva el texto codificado |
| Contrato §5.9 | Reordenaba `…12402` y `…12401` sin decir que el producto tenía dos imágenes (en §5.3 tiene una) | Aclara que en ese ejemplo el producto tiene las dos | Según la regla de §4.5 el ejemplo daba 400 |
| Contrato §6.2 | Textos del frontend sin punto final y distintos de las specs (p. ej. 429); faltaban 400 de resolución y de reordenamiento | Textos exactos y unificados con las specs 02/03; filas nuevas para esos 400 y para la subida mal formada | El instructivo exige textos exactos y había dos versiones |
| Contrato §8 | "Por usuario" | Por usuario y también por IP; los límites son por endpoint | D7, D16 |
| Contrato §10 | — | Lista de aclaraciones sin cambio de versión | Regla §9 / instructivo: la versión sigue siendo 1.1.0 |
| Spec 03 §6.2 | `escapeRegExp` | `escapeRegExp` + `buildSearchRegex` (tildes); reglas de `category` | D8, D10 |
| Spec 03 §7.2 | `@CurrentUser() user: AuthUser`, `user.id`; solo `@Throttle` | `PublicUser`, `user._id` (los tipos reales); `UserThrottlerGuard`; mensaje real de `LIMIT_UNEXPECTED_FILE` | D3, D7 |
| Spec 03 §7.3 | Paso 2 (404) antes del paso 3 (415) | El 415 por contenido va antes, porque los pipes corren antes del método; 409 previo; errores de `sharp` | D4, D5 |
| Spec 03 §7.3 y §8 | `{ new: true }` | `{ returnDocument: 'after' }` | `new` está obsoleto en Mongoose 9 |
| Spec 03 §9 | Pipeline con `$round` y `updateOne` | `findOneAndUpdate` con `finalPriceExpression` y `updatePipeline: true` (obligatorio en Mongoose 9) | D1; el endpoint debe devolver el `Product` |
| Spec 03 §10 | Faltaban 404 de imagen, 400 de resolución, de reordenamiento y de subida | Agregados, remitiendo al contrato §6.2 | Completar el catálogo |
| Spec 03 §12 | Omitía `SellerProductsQuery`, `LoginRequest` y el `null` de `UpdateProductRequest` | Mencionados en la nota | Coincidir con el contrato §3 |
| Spec 03 §13.3 | `ignoredActionPaths: ['meta.arg.onProgress']` | Agrega `'meta.arg.file'` | D12 |
| Spec 03 §13.4 | Nada sobre editar | Editar reemplaza la fila | D14 |
| Spec 03 §13.7 | `navy-400` 6.3:1, `navy-300` 3.2:1 | 6.1:1 y 3.1:1 (calculados con la fórmula WCAG) | Cifras inexactas; siguen cumpliendo AA |
| Spec 03 §14 | Solo `mongosh` | Alternativa sin `mongosh`; ubicación del script | D11, D18 |
| Spec 03 §15 | Variables nuevas sin regla | Obligatorias y validadas | D13 |
| Spec 03 §16 | `backend/scripts/seed.ts`; sin guard de throttling | `src/scripts/seed.ts`; `common/guards/user-throttler.guard.ts` | D7, D11 |
| Spec 03 §17 | `"Unexpected field"` | `"Unexpected file field - file"` | D3 |
| Spec 03 §18 tarea 11 | Sin decir dónde van los tests con MongoDB | En la suite e2e, que se actualiza a la 1.1.0 | D17 |
| Spec 02 §12 tarea 1 | "configurar ESLint" | "configurar oxlint" | Contradecía §3 (oxlint) y el código |
| Spec 01 §5.3 | `search` "sin distinguir mayúsculas" | "ni tildes" | Contradecía el criterio de §11 (`cafe` → `Café`) |

### Contrato vs. código al empezar

Todo esto lo cubren las tareas de §18:

- **Usuario:** sin `role` en schema, DTOs, respuesta ni JWT.
- **Producto:**
  - Sin `sellerId`, `discountPercent`, `finalPrice` ni `images`.
  - `sku` único global.
  - La respuesta es el documento crudo.
- **Rutas:**
  - Un solo `ProductsController` con CRUD global en `/products`.
  - Sin catálogo filtrado, sin `/products/categories` y sin endpoints de stock, descuento ni imágenes.
- **`UpdateProductDto`:** acepta `stock`.
- **Swagger:**
  - Versión `1.0.0` y tags `Auth`/`Products`.
  - `docs/openapi.json` de la 1.0.0.
- **Configuración:**
  - Sin `PUBLIC_BASE_URL` ni `UPLOADS_DIR`, y `uploads/` no está en `.gitignore`.
  - `frontend/.env.example` tenía un cambio local a `3001`; el contrato dice 3000.
- **Frontend:**
  - Tipos sin `role`, `ProductImage`, `SellerSummary`, `CatalogQuery`, etc.
  - Rutas solo `/products`.
  - Sin manejo de 403/413/415.
- **Dependencias:** faltan `sharp`, `file-type` como dependencia directa y `@types/multer`.
- **Datos y tests:**
  - `backend/seed/products.json` tiene 24 productos de la 1.0 y no hay `npm run seed`.
  - `test/app.e2e-spec.ts` prueba la 1.0.

## Tareas

### Tarea 1: versión 1.1.0 y `role` en el usuario

- **Hecho:** `info.version` de Swagger pasa a `1.1.0` (constante `API_VERSION`). El usuario tiene `role` (`seller` | `buyer`), obligatorio e inmutable en el schema, validado con `@IsIn` en `RegisterDto`, presente en `UserResponseDto`/`PublicUser` y en el payload del JWT (`{ sub, email, role }`).
- **Archivos:** `config/swagger.config.ts`, `users/schemas/user.schema.ts`, `users/users.service.ts`, `users/dto/user-response.dto.ts`, `auth/dto/register.dto.ts`, `auth/interfaces/jwt-payload.interface.ts`, `auth/auth.service.ts`, `auth/auth.controller.ts` (ejemplo de error), `auth/auth.service.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 22/22 ✅ · `npm run lint` sin errores ✅ · `npm run build` ✅ · `npm run test:e2e` 29/29 ✅.
- **Criterios de la §17:** registrarse sin `role` o con otro valor devuelve 400; `GET /auth/me` incluye `role`.
- **Notas:** el rol se lee de la base en `JwtStrategy` (que ya comprobaba que el usuario exista), así que el `role` del token es informativo.

### Tarea 2: `@Roles` + `RolesGuard`

- **Hecho:** decorador `@Roles(...roles)` (metadata `roles`) y `RolesGuard`, que lee `request.user.role` y lanza `ForbiddenException()` (mensaje `"Forbidden"`, como pide el contrato). Las rutas sin `@Roles` no se restringen y un `@Roles` en el método reemplaza al del controlador.
- **Archivos:** `common/decorators/roles.decorator.ts`, `common/guards/roles.guard.ts`, `common/guards/roles.guard.spec.ts`.
- **Verificación:** `npm test` 27/27 ✅ · lint ✅ · build ✅ · `test:e2e` 29/29 ✅.
- **Criterios de la §17:** base para "un comprador que llama a cualquier `/seller/...` recibe 403" (se aplica al controlador en la tarea 4, con su e2e).
- **Notas:** el guard lanza la excepción en vez de devolver `false`, porque Nest respondería `"Forbidden resource"`.

### Tarea 3: schema de producto e índices

- **Hecho:** el producto agrega `sellerId` (ObjectId, ref `User`, obligatorio), `discountPercent` (0–90, por defecto 0), `finalPrice` (obligatorio) e `images` (subdocumentos `ProductImage` con `_id`, `key`, `url`, `thumbUrl`, `width`, `height`; máximo 5 validado en el schema). `sku` deja de ser único global. Índices: `{ sellerId, sku }` único, `{ sellerId, createdAt }`, `{ isActive, createdAt }`, `{ isActive, finalPrice }`, `{ category }` y `{ name }`.
- **Archivos:** `products/schemas/product.schema.ts`, `products/schemas/product-image.schema.ts`, `products/products.service.ts`, `products/products.controller.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 27/27 ✅ · lint ✅ · build ✅ · `test:e2e` 29/29 ✅.
- **Criterios de la §17:** base para "dos vendedores pueden usar el mismo SKU" (índice compuesto; el e2e llega en la tarea 4).
- **Notas:** para que el CRUD 1.0 siga funcionando hasta la tarea 4, `create` ya recibe el `sellerId` del usuario autenticado y guarda `discountPercent: 0` y `finalPrice = price`. La base local de desarrollo todavía tiene el índice único viejo de `sku`; desaparece al reiniciar la base (seed, tarea 10).

### Tarea 4: `CatalogController` y `SellerProductsController`

- **Hecho:**
  - `ProductsController` se divide en `CatalogController` (`GET /products` y `GET /products/:id`, solo productos activos) y `SellerProductsController` (CRUD en `/seller/products` con `JwtAuthGuard` + `RolesGuard` y `@Roles('seller')`).
  - Todas las operaciones del vendedor filtran por `{ _id, sellerId }` en la misma consulta (`findOne`, `findOneAndUpdate`, `findOneAndDelete`).
  - Las respuestas pasan por `toProductView`, que convierte `sellerId` en `seller: { _id, name }` (con `populate('sellerId', 'name')` en el catálogo) y quita la `key` interna de las imágenes.
  - Query del vendedor con `sortBy=finalPrice`. `CatalogQueryDto` básico (página 1, límite 12, máximo 48); los filtros llegan en la tarea 5.
  - Tags de Swagger `Catalog` y `Seller products`.
- **Archivos:** `products/catalog.controller.ts`, `products/seller-products.controller.ts`, `products/products.swagger.ts`, `products/product-view.ts`, `products/products.service.ts`, `products/products.module.ts`, `products/dto/catalog-query.dto.ts`, `products/dto/seller-products-query.dto.ts` (antes `query-products.dto.ts`), `products/dto/search.decorator.ts`, `products/dto/product-response.dto.ts`, `config/swagger.config.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`; se elimina `products/products.controller.ts`.
- **Verificación:** `npm test` 29/29 ✅ · lint ✅ · build ✅ · `test:e2e` 40/40 ✅.
- **Criterios de la §17:**
  - Un comprador recibe 403 en `/seller/...`.
  - Un vendedor recibe 404 con un producto ajeno (ver, editar, eliminar).
  - Enviar `sellerId` en crear o editar devuelve 400.
  - `GET /seller/products` devuelve solo los suyos, incluidos los ocultos.
  - Dos vendedores pueden repetir SKU; el mismo no (409).
  - El catálogo no devuelve ocultos y su detalle responde 404.
  - El catálogo incluye `seller.name` sin email.
- **Notas:**
  - Los tokens del segundo vendedor y del comprador se firman en el e2e con `JwtService`, para no chocar con el límite de 5 logins por minuto.
  - Mientras no haya descuentos (tarea 7), un `PATCH` de `price` copia el precio a `finalPrice`.

### Tarea 5: query del catálogo y categorías

- **Hecho:**
  - `CatalogQueryDto` agrega `category` (≤ 50, exacta), `minPrice`/`maxPrice` (≥ 0, sobre `finalPrice`, con `@IsNotGreaterThan('maxPrice')` → `"minPrice must not be greater than maxPrice"`), `onSale` e `inStock` con `@Transform(({ value }) => value === 'true')`.
  - `escapeRegExp` vive en `common/utils/escape-regexp.ts` y lo usa `buildSearchRegex`.
  - `GET /products/categories` (declarado antes de `:id`) devuelve las categorías distintas de los productos activos, ordenadas con `Intl.Collator('es')`.
- **Archivos:** `common/utils/escape-regexp.ts`, `common/utils/search-regex.util.ts`, `common/utils/search-regex.util.spec.ts`, `common/decorators/is-not-greater-than.decorator.ts`, `products/dto/catalog-query.dto.ts`, `products/dto/catalog-query.dto.spec.ts`, `products/products.service.ts`, `products/catalog.controller.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 42/42 ✅ · lint ✅ · build ✅ · `test:e2e` 47/47 ✅.
- **Criterios de la §17:**
  - `minPrice` y `maxPrice` filtran por precio final, y `minPrice > maxPrice` devuelve 400.
  - `onSale=false` no filtra.
  - `search=.*` busca el texto literal. Además hay un test de ReDoS con `(a+)+$`.
- **Notas:** el orden de categorías usa `Intl.Collator('es', { sensitivity: 'base' })` sobre el resultado de `distinct`, equivalente a la collation `es` de MongoDB y sin depender de ella.

### Tarea 6: ajuste de stock atómico

- **Hecho:**
  - `POST /seller/products/:id/stock-adjustments` (200) con `StockAdjustmentDto` (`type`: `increase`/`decrease`; `quantity`: entero de 1 a 100 000).
  - La salida usa un único `findOneAndUpdate({ _id, sellerId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })`. Si no actualiza nada, `exists({ _id, sellerId })` decide entre 404 y 409 `"Insufficient stock"`.
  - `UpdateProductDto` = `PartialType(OmitType(CreateProductDto, ['stock']))`, así que `PATCH` con `stock` devuelve 400.
  - `create` arma el documento campo por campo (quita un aviso de lint por usar *spread* sobre una instancia de clase).
- **Archivos:** `products/dto/stock-adjustment.dto.ts`, `products/dto/update-product.dto.ts`, `products/products.service.ts`, `products/seller-products.controller.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 46/46 ✅ · lint ✅ (sin avisos) · build ✅ · `test:e2e` 54/54 ✅.
- **Criterios de la §17:**
  - `PATCH` con `stock` devuelve 400.
  - Una salida mayor al stock devuelve 409 y el stock no cambia.
  - Diez salidas simultáneas de 1 sobre un stock de 5 dejan 0: test e2e contra MongoDB real, con cinco 200 y cinco 409.

### Tarea 7: precio final, descuentos y recálculo con *update pipeline*

- **Hecho:**
  - `pricing.ts` tiene `calculateFinalPrice` (JS) y `finalPriceExpression` (agregación), con la misma fórmula en centavos (D1).
  - `PUT /seller/products/:id/discount` (`percent` entero de 1 a 90) y `DELETE /seller/products/:id/discount` (idempotente) usan `findOneAndUpdate({ _id, sellerId }, [ { $set: { discountPercent } }, { $set: { finalPrice: finalPriceExpression } } ], { returnDocument: 'after', updatePipeline: true })`.
  - `PATCH` pasa a ser un *update pipeline*: `$set` de los campos enviados envueltos en `$literal`, `$unset` de los `null` y una última etapa que recalcula `finalPrice`.
  - `description` y `category` se recortan en el DTO, porque el pipeline no aplica el `trim` del schema.
- **Archivos:** `products/pricing.ts`, `products/pricing.spec.ts`, `products/dto/discount.dto.ts`, `products/dto/create-product.dto.ts`, `products/products.service.ts`, `products/seller-products.controller.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 56/56 ✅ · lint ✅ · build ✅ · `test:e2e` 62/62 ✅.
- **Criterios de la §17:**
  - Aplicar 15 % a 145 000 devuelve `finalPrice: 123250`.
  - Cambiar el precio de un producto con descuento recalcula `finalPrice` (30 000 con 10 % → 27 000, el ejemplo del contrato §5.5).
  - Un descuento de 0 o de 91 devuelve 400.
- **Notas:**
  - Un test unitario evalúa `finalPriceExpression` para 11 precios × 91 porcentajes y compara con `calculateFinalPrice`. El e2e repite la comparación contra MongoDB real con los casos límite (0,05 con 30 %, 10,05 con 50 %, etc.).
  - Sin `$literal`, un nombre como `"$price"` se leería como ruta de campo dentro del pipeline; hay test unitario y e2e de eso.
  - Mongoose agrega la etapa de `updatedAt` al final del arreglo del pipeline, por eso el arreglo se construye nuevo en cada llamada.

### Tarea 8: `StorageService`, `LocalDiskStorage` y `/uploads`

- **Hecho:**
  - `StorageService` es una clase abstracta (sirve de token de inyección) con `save`, `delete` y `getPublicUrl`.
  - `LocalDiskStorage` guarda en `<UPLOADS_DIR>/products`, arma URLs absolutas con `PUBLIC_BASE_URL` y rechaza claves que no sean `nombre.ext` simple (evita salir de la carpeta). Borrar un archivo que no existe no es error.
  - `PUBLIC_BASE_URL` y `UPLOADS_DIR` son obligatorias y se validan al arrancar.
  - `configureApp` sirve `UPLOADS_DIR` en `/uploads` (fuera de `/api/v1`, sin JWT) con `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` y `Cross-Origin-Resource-Policy: cross-origin`. Ahora recibe un objeto de opciones y una `NestExpressApplication`.
  - `uploads/` y `uploads-e2e/` en `.gitignore`.
- **Archivos:** `modules/storage/storage.service.ts`, `modules/storage/local-disk.storage.ts`, `modules/storage/local-disk.storage.spec.ts`, `modules/storage/storage.module.ts`, `app.module.ts`, `app.setup.ts`, `main.ts`, `config/env.validation.ts`, `.env.example`, `vitest.config.e2e.ts`, `test/app.e2e-spec.ts`, `.gitignore` (raíz).
- **Verificación:** `npm test` 60/60 ✅ · lint ✅ · build ✅ · `test:e2e` 64/64 ✅.
- **Criterios de la §17:** base para que las imágenes carguen desde `localhost:5173` (header CORP comprobado en e2e; el resto del API mantiene `same-origin`).
- **Notas:**
  - El `.env` local (fuera de git) también recibió las dos variables, con `PUBLIC_BASE_URL=http://localhost:3001` porque en esta máquina el backend corre en 3001.
  - La suite e2e usa `./uploads-e2e` y lo borra antes y después.

### Tarea 9: imágenes (Multer, `ImageFilePipe`, `sharp`, endpoints y límite)

- **Hecho:**
  - `images/multer.config.ts` según la spec §7.2: `memoryStorage()`, límites (`fileSize: 1_048_576`, `files: 1`, `fields: 0`, `parts: 1`) y `fileFilter` por MIME → 415.
  - `ImageFilePipe`: archivo obligatorio (400 `"Image is required"`) y *magic numbers* con `fileTypeFromBuffer` (415).
  - `ImageProcessingService` (`sharp` con `limitInputPixels: 40_000_000`): `rotate()`, WebP de 1200 px como máximo (calidad 80) y miniatura de 400 × 400 con `cover` (calidad 75), sin metadatos. Más de 40 MP → 400 `"Image dimensions too large"`; si no se puede decodificar → 415.
  - Endpoints `POST /:id/images` (`FileInterceptor('image', imageUploadOptions)`, `@ApiConsumes('multipart/form-data')` + `@ApiBody`, `@Throttle` de 20 por minuto y `UserThrottlerGuard`), `DELETE /:id/images/:imageId` y `PUT /:id/images/order`.
  - Límite de 5 con `$push` condicional `'images.4': { $exists: false }` y una comprobación previa para no procesar en vano.
  - Al borrar un producto o una imagen se actualiza la base primero y luego se borran los archivos (los errores solo se registran en el log).
  - Dependencias: `sharp`, `file-type` y `@types/multer` (dev). No se instaló `multer`.
- **Archivos:** `images/multer.config.ts`, `images/image-file.pipe.ts`, `images/image-processing.service.ts`, `images/images.module.ts` (con sus tres `.spec.ts`), `common/guards/user-throttler.guard.ts` (+ spec), `products/dto/reorder-images.dto.ts`, `products/products.service.ts`, `products/seller-products.controller.ts`, `products/products.module.ts`, `app.module.ts`, `products/products.service.spec.ts`, `test/app.e2e-spec.ts`, `package.json`, `package-lock.json`.
- **Verificación:** `npm test` 96/96 ✅ · lint ✅ · build ✅ · `test:e2e` 80/80 ✅.
- **Criterios de la §17:**
  - Un JPEG de unos 900 KB devuelve 201, y `url` y `thumbUrl` cargan con CORP `cross-origin`.
  - Con 1 048 577 bytes → 413.
  - Un `.txt` renombrado a `.png` → 415.
  - La sexta imagen → 409 (y dos subidas simultáneas por el último lugar dan 201 + 409 sin archivos huérfanos).
  - Sin archivo → 400 `"Image is required"`; con el campo `file` → 400 `"Unexpected file field - file"`; con dos archivos → 400.
  - Un comprador o una petición sin token recibe 403/401 sin que Multer lea el archivo.
  - Las imágenes guardadas son WebP sin EXIF.
  - Eliminar un producto borra sus archivos.
- **Notas:**
  - En el test de "sin que Multer lea el archivo" se usa un archivo `text/plain`: si Multer lo leyera, su filtro respondería 415. Con un archivo grande, el servidor responde antes de leer el cuerpo y la conexión se corta (`ECONNRESET`).
  - El test del límite de 20 por minuto va al final del bloque y repite hasta ver el 429, por si la ventana se reinicia en medio.

### Tarea 10: datos de prueba (`npm run seed`)

- **Hecho:**
  - `src/scripts/seed.ts` (D11), ejecutado con `npm run seed` (`nest build && node dist/scripts/seed.js`). Vacía `users` y `products`, sincroniza sus índices (elimina el único global de `sku` de la 1.0.0) y vacía `uploads/products`.
  - Crea 2 vendedores y 1 comprador (contraseña `Clave1234`) y 30 productos repartidos entre los vendedores: 8 con descuento (con `calculateFinalPrice`), 3 agotados, 3 ocultos y uno sin categoría.
  - Imágenes propias en `seed/images/` (13 JPEG generados con `sharp` a partir de SVG, uno por categoría más uno de "detalle"), procesadas con `ImageProcessingService` y guardadas con `StorageService`.
  - `seed/products.json` pasa de 24 a 30 productos (6 nuevos, entre ellos los cafés del ejemplo del contrato).
  - README del backend: variables nuevas, base vacía, seed y credenciales.
- **Archivos:** `src/scripts/seed.ts`, `seed/products.json`, `seed/images/*.jpg`, `package.json`, `README.md`.
- **Verificación:**
  - `npm test` 96/96 ✅ · lint ✅ · build ✅ · `test:e2e` 80/80 ✅.
  - `npm run seed` ejecutado dos veces seguidas: quedan 3 usuarios, 30 productos y 31 imágenes (62 archivos), y los índices quedan como en la spec §5.2.
  - Prueba manual con `node dist/main.js`: login de la compradora, catálogo con `onSale=true` (7 activos, con `seller.name`) y miniatura servida con `Cross-Origin-Resource-Policy: cross-origin` y `image/webp`.
- **Criterios de la §17:** con la base vacía, `npm run seed` crea los usuarios y productos de prueba con imágenes y se puede repetir sin duplicar nada.
- **Notas:**
  - Cada producto guarda sus propias copias de las imágenes (cada imagen de origen se procesa una sola vez), para que borrar un producto no afecte a otro.
  - Ejecutar el seed borró la base de desarrollo local `productos_db`, como pide la spec §14.

### Tarea 11: tests

- **Hecho:** los tests que pide la tarea se escribieron junto a cada funcionalidad, y aquí se completan los huecos. Resumen:
  - **Guard de roles:** `roles.guard.spec.ts` (unitario). Nuevo e2e: un comprador recibe 403 en los 11 endpoints del vendedor y puede leer el catálogo.
  - **Stock:** unitarios de `adjustStock` y e2e (409 sin cambios, validación, concurrencia de 10 salidas sobre 5 → 0).
  - **Precio final:** `pricing.spec.ts` (incluye la equivalencia JS ↔ pipeline en 1001 combinaciones) y e2e contra MongoDB real.
  - **Validación de imágenes:** `multer.config.spec.ts`, `image-file.pipe.spec.ts`, `image-processing.service.spec.ts` y el bloque e2e `Images` (413, 415, 400, 409, EXIF, concurrencia del `$push`, límite de 20 por minuto).
  - **Nuevo `env.validation.spec.ts`:** la app no arranca sin `JWT_SECRET`, `MONGO_URI`, `PUBLIC_BASE_URL` o `UPLOADS_DIR`.
- **Archivos:** `config/env.validation.spec.ts`, `test/app.e2e-spec.ts`.
- **Verificación:** `npm test` 102/102 ✅ (12 archivos) · lint ✅ · build ✅ · `test:e2e` 82/82 ✅.
- **Criterios de la §17:** los de roles, productos del vendedor e imágenes quedan cubiertos por tests (ver cada tarea).
- **Notas:**
  - El bloque e2e de roles va antes que el de imágenes. El throttler global (por IP) se ejecuta antes que la autenticación, así que, una vez agotado el límite de subidas, la ruta de imágenes responde 429 incluso a un comprador. Es el orden esperado (contrato §4.5).
  - El spec de `env.validation` importa `reflect-metadata` porque no carga nada de Nest.

### Tarea 12: Swagger y `openapi.json`

- **Hecho:** tags `Auth`, `Catalog` y `Seller products` (aplicados desde la tarea 4); título y descripción general de Swagger actualizados para la 1.1.0 (roles, cómo probar, 403/404, `/uploads`); `docs/openapi.json` regenerado con `npm run docs:export`. Cada endpoint tiene `@ApiOperation`, parámetros, cuerpo con ejemplo y todas sus respuestas con el esquema `ErrorResponseDto` y ejemplos. La subida usa `@ApiConsumes('multipart/form-data')` + `@ApiBody` con `format: 'binary'`. `api-contract.md` ya estaba en 1.1.0 (con las aclaraciones de la fase 0).
- **Archivos:** `config/swagger.config.ts`, `docs/openapi.json`.
- **Verificación:** `npm test` 102/102 ✅ · lint ✅ · build ✅ · `test:e2e` 82/82 ✅ · `docs:export` ✅. `info.version` es `1.1.0`; las 14 operaciones coinciden con el contrato §2 (además del 429 que el contrato admite en cualquier endpoint) y ningún esquema de respuesta tiene `password`.
- **Criterios de la §17:** `docs/openapi.json` refleja la 1.1.0, incluido el `multipart/form-data`; en Swagger la subida muestra un selector de archivo; `api-contract.md` está en 1.1.0.
- **Notas:** el esquema `UpdateProductDto` hereda de `CreateProductDto` y no marca `description`/`category` como `nullable`; el borrado con `null` está explicado en la descripción del endpoint.

### Tarea 13: tipos, `VITE_API_URL` y capa de API del frontend

- **Hecho:**
  - **Tipos:** `types/` copia el contrato 1.1.0 §3: `UserRole`, `User.role`, `RegisterRequest.role`, `ProductImage`, `SellerSummary`, `Product` completo, `UpdateProductRequest` sin `stock` y con `null`, los requests de stock/descuento/orden, los tipos de orden y los queries.
  - **API:** `productsApi` apunta a `/seller/products` y agrega `get`, `adjustStock`, `setDiscount`, `removeDiscount`, `uploadImage` (`FormData` sin fijar `Content-Type`, progreso con `onUploadProgress`), `deleteImage` y `reorderImages`. Nuevo `catalogApi` (`list`, `categories`, `get`).
  - **Errores:** `errorMessages.ts` mapea 403, 413, 415, los 400 de imágenes, el 404 de imagen y los 409 por ruta, con los textos exactos del contrato §6.2.
  - **Configuración:** `frontend/.env.example` vuelve a `http://localhost:3000/api/v1` (tenía un cambio local a 3001). El `.env` local sigue en 3001.
  - El formulario de edición ya no envía `stock`.
- **Archivos:** `types/auth.ts`, `types/product.ts`, `api/productsApi.ts`, `api/catalogApi.ts`, `utils/errorMessages.ts`, `utils/errorMessages.test.ts`, `features/products/productForm.ts`, `features/products/productsSlice.test.ts` (datos con los campos nuevos), `features/auth/RegisterPage.tsx`, `features/auth/RoleSelector.tsx`, archivos que usaban `ProductSortField` (ahora `SellerProductSortField`), `.env.example`.
- **Verificación:** `npm test` 30/30 ✅ · `npm run lint` ✅ · `npm run build` ✅.
- **Criterios de la §17:** base de todos los del frontend.
- **Notas:** el selector de rol del registro (tarea 14) se adelantó aquí. Con `role` obligatorio en `RegisterRequest` el registro no compila sin él, y el backend 1.1.0 lo rechaza. Es un `RadioGroup` de Headless UI con "Quiero comprar" / "Quiero vender", sin opción preseleccionada. El texto de error "Elige si quieres comprar o vender." no estaba en la spec.

### Tarea 14: rol en `authSlice`, `ProtectedRoute` con `roles` y redirección por rol

- **Hecho:**
  - **`authSlice`:** `HOME_PATHS` (`seller` → `/seller/products`, `buyer` → `/catalog`), `selectRole` y `selectHomePath`.
  - **`ProtectedRoute({ roles })`:** con el rol incorrecto redirige a la pantalla de inicio del rol y muestra una sola vez "No tienes acceso a esa sección.".
  - **Redirecciones:** `/` → `HomeRedirect` según el rol. `/products` (dirección de la 1.0) redirige a `/`. El login va a `from` o al inicio del rol, y el registro, al inicio del rol.
  - **Rutas:** las rutas viven en `app/routes.tsx` (las usa el test) y las páginas diferidas en `app/lazyPages.tsx`. `/catalog` muestra por ahora un `CatalogPage` básico, que se completa en la tarea 18.
  - **Barra superior:** enlaces por rol ("Mis productos" + "Catálogo" para el vendedor; solo "Catálogo" para el comprador).
  - `NotFoundPage` enlaza a `/`. El setup de tests ejecuta `cleanup()` después de cada test.
- **Archivos:** `features/auth/authSlice.ts`, `components/ProtectedRoute.tsx`, `components/AppLayout.tsx`, `components/NotFoundPage.tsx`, `features/auth/LoginPage.tsx`, `features/auth/RegisterPage.tsx`, `features/catalog/CatalogPage.tsx`, `app/routes.tsx`, `app/lazyPages.tsx`, `App.tsx`, `test/setup.ts`, `app/routes.test.tsx`.
- **Verificación:** `npm test` 35/35 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:** el login del vendedor lleva a `/seller/products` y el del comprador a `/catalog`; un comprador que escribe `/seller/products` termina en `/catalog` con aviso (test con el router real en memoria).
- **Notas:** el selector de rol del registro ya se había hecho en la tarea 13. Un 403 del API se muestra con el mismo texto a través de `errorMessages`; con las rutas protegidas por rol no debería ocurrir en uso normal.

### Tarea 15: `features/seller`, `Pagination`, `PriceTag`, columnas nuevas y menú de acciones

- **Hecho:**
  - **Renombres:** `features/products` → `features/seller` (`sellerProductsSlice`, clave `sellerProducts` en el store, acciones `sellerProducts/*`, `SellerProductsPage`).
  - **`Pagination`:** se extrae a `components/` como componente de presentación reutilizable, ahora con páginas numeradas (1 … 4 5 6 … 10), tamaño de página y anterior/siguiente.
  - **Componentes nuevos:**
    - `components/PriceTag.tsx`: precio final, precio de lista tachado `text-navy-400` y etiqueta `-15%` en `bg-red-600`.
    - `StockBadge`: "Agotado" / "Stock bajo" (≤ 5).
    - `ProductThumbnail`: 40 px o icono gris.
    - `ProductActionsMenu`: `Menu` de Headless UI con Editar, Imágenes, Ajustar stock, Descuento y Eliminar.
  - **Tabla:** columnas Imagen, Nombre, SKU, Categoría, Precio (ordena por `finalPrice`), Stock con etiqueta, Estado ("Visible"/"Oculto") y menú "⋯".
  - **Tarjetas móviles:** miniatura, precio con descuento, etiquetas de stock y el mismo menú.
  - **Formatters:** `formatPercent` ("15 %") y `formatFileSize` ("2,3 MB", base 1024).
  - **Tests:** polyfill de `ResizeObserver` para Headless UI en jsdom.
- **Archivos:** `features/seller/**` (renombrados), `components/Pagination.tsx`, `components/PriceTag.tsx`, `components/icons.tsx`, `features/seller/components/{StockBadge,ProductThumbnail,ProductActionsMenu,ProductTable,ProductCardList,ProductStatusBadge,ProductsToolbar}.tsx`, `features/seller/SellerProductsPage.tsx`, `utils/formatters.ts`, `app/store.ts`, `app/lazyPages.tsx`, `app/routes.tsx`, `test/setup.ts`, `components/sharedComponents.test.tsx`.
- **Verificación:** `npm test` 41/41 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:** base para "ajustar stock, aplicar descuento, ocultar y subir imágenes actualizan la fila sin recargar toda la tabla" (tareas 16 y 17).
- **Notas:**
  - El menú solo ofrece las acciones que ya tienen diálogo en la página (Editar y Eliminar); las tareas 16 y 17 agregan las demás.
  - `formatPercent` arma "15 %" a mano, porque el ICU de Node/navegadores da "15%" con `es-CO`.

### Tarea 16: `StockAdjustDialog`, `DiscountDialog` e interruptor de visibilidad

- **Hecho:**
  - **Thunks nuevos:** `adjustStock`, `setDiscount`, `removeDiscount` y `toggleActive`. Igual que `updateProduct` (D14), reemplazan el producto en `items` con la respuesta, sin volver a pedir la lista. Ante un 404 recargan la lista. `adjustStock` con 409 vuelve a leer el producto (`productRefreshed`) para mostrar el stock real.
  - **Estado:** `togglingIds` deshabilita solo el interruptor que se está guardando; `saving` cubre los diálogos.
  - **`StockAdjustDialog`:** control segmentado Entrada/Salida (`RadioGroup`), cantidad de 1 a 100 000 y vista previa "Stock actual 40 → 45". Una salida mayor al stock no se envía ("No hay suficiente stock para esa salida.") y el 409 del backend se muestra en el campo.
  - **`DiscountDialog`:** porcentaje de 1 a 90, vista previa en vivo ("$ 145.000 → $ 123.250 (-15 %)") con la misma fórmula del backend (`utils/pricing.ts`), y botones "Guardar" y "Quitar descuento" (este solo si ya tiene descuento).
  - **`VisibilitySwitch`:** `Switch` de Headless UI "Visible / Oculto" en la columna Estado y en las tarjetas.
  - **Formulario:** al editar, el stock es solo lectura con el enlace "Ajustar stock"; al crear se pide "Stock inicial".
  - Los diálogos usan `useWatch` en vez de `watch` (aviso de compatibilidad con React Compiler de oxlint).
- **Archivos:** `features/seller/sellerProductsSlice.ts`, `features/seller/SellerProductsPage.tsx`, `features/seller/components/{StockAdjustDialog,DiscountDialog,VisibilitySwitch,ProductFormDialog}.tsx`, `utils/pricing.ts`, `features/seller/sellerProductsSlice.test.ts`, `features/seller/components/dialogs.test.tsx`.
- **Verificación:** `npm test` 52/52 ✅ · lint ✅ (sin avisos) · build ✅.
- **Criterios de la §17:** ajustar stock, aplicar descuento y ocultar actualizan la fila sin recargar la tabla (tests del slice: `api.list` no se llama); Redux DevTools muestra `pending/fulfilled/rejected` de los thunks nuevos (`createAsyncThunk`).
- **Notas:** textos de notificación que la spec no definía: "Descuento aplicado", "Descuento quitado", "Producto visible en el catálogo" y "Producto oculto del catálogo". "Stock actualizado" sí viene de la spec.

### Tarea 17: `ProductImagesDialog` + `ImageDropzone`

- **Hecho:**
  - **`utils/imageValidation.ts`:** `validateImageFile(file)` con `MAX_IMAGE_BYTES = 1_048_576` y los tipos JPEG/PNG/WebP. Mensajes de la spec: "foto.png pesa 2,3 MB. El máximo es 1 MB." / "documento.pdf no es una imagen válida. Usa JPG, PNG o WebP.".
  - **Thunks `uploadImage`, `deleteImage` y `reorderImages`:** reemplazan la fila. `uploadImage` recibe `onProgress` y lo pasa al `onUploadProgress` de axios. Tras un 400/404 de imagen se vuelve a leer el producto.
  - **Store:** `serializableCheck.ignoredActionPaths: ['meta.arg.onProgress', 'meta.arg.file']` (D12).
  - **`ImageDropzone`:** arrastrar y soltar más un botón "Elegir archivos" (`accept="image/jpeg,image/png,image/webp" multiple`), con los estilos de la spec §13.7; se desactiva con 5 imágenes.
  - **`ProductImagesDialog`:**
    - Cuadrícula con "3 de 5" y "Principal".
    - "Hacer principal" (endpoint de orden) y "Eliminar" con confirmación.
    - Los archivos se validan antes de subir: los rechazados se listan y no se envían, y también se rechazan los que superarían el límite de 5.
    - Los válidos se suben uno por uno (cola de promesas) con una barra de progreso por archivo.
  - Después de crear un producto se abre el diálogo con "Producto creado. Ahora agrega sus imágenes.".
  - El menú de acciones ya ofrece las 5 acciones.
- **Archivos:** `utils/imageValidation.ts` (+ test), `app/store.ts`, `features/seller/sellerProductsSlice.ts`, `features/seller/SellerProductsPage.tsx`, `features/seller/components/{ImageDropzone,ProductImagesDialog,ProductFormDialog}.tsx`, `features/seller/components/ProductImagesDialog.test.tsx`.
- **Verificación:** `npm test` 63/63 ✅ · lint ✅ (sin avisos) · build ✅.
- **Criterios de la §17:**
  - Elegir una imagen de 2 MB muestra el error sin hacer ninguna petición.
  - La subida muestra una barra de progreso por archivo.
  - Subir imágenes actualiza la fila sin recargar la tabla.
- **Notas:**
  - Mientras hay subidas en curso, el diálogo no se puede cerrar ("Subiendo…").
  - El diálogo muestra la fila del store si el producto está en la página actual, y si no (recién creado), su copia local con las respuestas del backend.
  - En los tests se usa `applyAccept: false`, porque un archivo arrastrado no pasa por el filtro `accept`.

### Tarea 18: `catalogSlice`, `catalogQuery.ts` y `CatalogPage` con grilla y tarjetas

- **Hecho:**
  - **`utils/catalogQuery.ts`:**
    - `parseCatalogQuery` (URL → query con los valores por defecto del contrato §4.6). Ignora valores inválidos: `?page=abc` → 1, un `sortBy` desconocido toma el valor por defecto y un mínimo mayor que el máximo se descarta.
    - `toSearchParams` (query → URL, sin valores por defecto ni vacíos).
    - `activeFilterCount` y `CATALOG_PAGE_SIZES` (12, 24, 48).
  - **`catalogSlice`:** `items`, `meta`, `categories`, `selected`, `status`, `error`, más `selectedStatus`/`selectedError` para que el detalle distinga un 404. Thunks `fetchCatalog` (cancelable), `fetchCategories` y `fetchCatalogProduct`. Se limpia al cerrar sesión.
  - **`useCatalogQuery`:** la URL es la fuente de verdad, en un solo sentido: `useSearchParams` → `parseCatalogQuery` → `dispatch(fetchCatalog(query))`. Los cambios escriben la URL y vuelven a la página 1, salvo un cambio de página.
  - **`CatalogPage`:** grilla `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` con `gap-3 md:gap-4` y paginación numerada de 12/24/48.
  - **`ProductCard`:** imagen cuadrada `thumbUrl` con `loading="lazy"` y `alt` con el nombre, icono sin imagen, etiqueta `-15%`, capa "Agotado", nombre `line-clamp-2`, categoría, "por {vendedor}" y precio con tachado. Toda la tarjeta enlaza a `/catalog/:id` con foco visible.
- **Archivos:** `utils/catalogQuery.ts` (+ test), `features/catalog/{catalogSlice.ts,catalogSlice.test.ts,useCatalogQuery.ts,CatalogPage.tsx}`, `features/catalog/components/{ProductCard,ProductGrid}.tsx`, `app/store.ts`, `app/routes.test.tsx` (simula `catalogApi`).
- **Verificación:** `npm test` 78/78 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:**
  - Los filtros del catálogo se reflejan en la URL; al recargar o compartir el enlace se ven los mismos resultados (el estado sale de la URL).
  - Las tarjetas de productos agotados muestran "Agotado".
- **Notas:** el buscador, el orden y los filtros se agregan en la tarea 19, y los estados de carga, vacío y error se completan en la tarea 21.

### Tarea 19: filtros del catálogo

- **Hecho:**
  - **`CatalogFilters`:** controles de categoría ("Todas" + `GET /products/categories`), precio mínimo/máximo, "Solo con descuento" y "Solo disponibles".
  - **`FiltersPanel` (escritorio, `lg:`, `w-64` fijo a la izquierda):** categoría y casillas se aplican al instante; los precios, al salir del campo o con "Aplicar precio".
  - **`FiltersDrawer` (móvil y tablet):** `Dialog` lateral de Headless UI que edita un borrador, con "Aplicar" y "Limpiar".
  - **`ActiveFilterChips`:** un chip por filtro con ✕, más "Limpiar filtros".
  - **`CatalogToolbar`:** buscador con espera de 400 ms, selector de orden (Más recientes · Menor precio · Mayor precio · Nombre A–Z · Mayor descuento) y botón "Filtros (n)". El total ("42 productos") va encima de la grilla.
  - Todo escribe en la URL a través de `useCatalogQuery`, y cualquier cambio de filtro vuelve a la página 1.
- **Archivos:** `features/catalog/catalogFilters.ts`, `features/catalog/components/{CatalogFilters,FiltersPanel,FiltersDrawer,ActiveFilterChips,CatalogToolbar}.tsx`, `features/catalog/CatalogPage.tsx`, `features/catalog/CatalogPage.test.tsx`.
- **Verificación:** `npm test` 85/85 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:**
  - Los filtros del catálogo se reflejan en la URL (tests: la URL inicial llega al API, y cada filtro, chip, orden y borrador del panel escribe la URL).
  - Base del criterio responsive (panel fijo en `lg:` y panel lateral debajo), que se verifica en la tarea 21.
- **Notas:**
  - Texto que la spec no definía: "El precio mínimo no puede ser mayor que el máximo." (validación del cliente antes de escribir la URL).
  - Los chips cuentan solo filtros (categoría, rango de precio, descuento, disponibles). El buscador y el orden no cuentan en "Filtros (n)", y "Limpiar filtros" conserva la búsqueda, el orden y el tamaño de página.

### Tarea 20: `ProductDetailPage` con galería

- **Hecho:**
  - **Ruta:** `/catalog/:id` (comprador y vendedor) con `ProductDetailPage`, que carga con `fetchCatalogProduct` (cancelable).
  - **`ImageGallery`:** imagen grande (`url`, con `width`/`height` para reservar el espacio) y miniaturas debajo como `RadioGroup` de Headless UI, elegibles con clic o con las flechas del teclado.
  - **Datos:** nombre, "Vendido por {vendedor}", categoría, `PriceTag` grande con tachado y etiqueta, disponibilidad ("Disponible · 12 unidades" / "Agotado") y descripción. Sin botón "Comprar".
  - **"← Volver al catálogo":** `navigate(-1)` si se llegó desde una tarjeta del catálogo (`state.fromCatalog`), lo que conserva los filtros de la URL; si no, `/catalog`.
  - **404 (o id inválido):** "Este producto ya no está disponible" con enlace al catálogo. Otros errores: mensaje y "Reintentar".
- **Archivos:** `features/catalog/ProductDetailPage.tsx` (+ test), `features/catalog/components/ImageGallery.tsx`, `features/catalog/components/ProductCard.tsx` (estado del enlace), `app/lazyPages.tsx`, `app/routes.tsx`.
- **Verificación:** `npm test` 91/91 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:** detalle con galería y regreso conservando los filtros (spec 03 §13.6; no tiene criterio propio en la §17).

### Tarea 21: estados del catálogo y ajustes responsive

- **Hecho:**
  - **Estados de la spec 03 §13.5:**
    - Primera carga: tarjetas esqueleto.
    - Recarga: la grilla actual con opacidad reducida y el indicador "Actualizando…", sin parpadeo.
    - Sin resultados con filtros o búsqueda: "No encontramos productos con esos filtros" y "Limpiar filtros" (que aquí también limpia la búsqueda).
    - Catálogo vacío: "Todavía no hay productos publicados".
    - Error: mensaje amigable y "Reintentar".
  - **Estado extra:** una página que ya no existe (enlace viejo con `?page=9`) muestra "Esta página no tiene productos" e "Ir a la primera página".
  - **Responsive:**
    - Por debajo de `sm:`, la paginación muestra "3 / 10" en lugar de los números, que no caben a 360 px (7 botones de 44 px).
    - Grilla `grid-cols-2 md:grid-cols-3 xl:grid-cols-4`; panel de filtros fijo desde `lg:` y panel lateral por debajo.
- **Archivos:** `features/catalog/CatalogPage.tsx`, `features/catalog/useCatalogQuery.ts` (`clearAll`), `components/Pagination.tsx`, `features/catalog/CatalogPage.test.tsx`.
- **Verificación:** `npm test` 97/97 ✅ · lint ✅ · build ✅.
- **Criterios de la §17:** a 360 px el catálogo muestra 2 columnas y los filtros en panel lateral; a 1280 px, panel fijo y 4 columnas (clases verificadas aquí; se revisa en el navegador en la fase 2).
- **Notas:** el estado "página sin productos" y que el botón del estado vacío también limpie la búsqueda son decisiones propias, para que el botón siempre lleve a resultados.

### Tarea 22: tests del frontend

- **Hecho:** los tests que pide la tarea se escribieron junto a cada funcionalidad, y aquí se completan los de `deleteImage` y `reorderImages`. Resumen:
  - `catalogSlice.test.ts`: estado inicial, carga, error, cancelación, categorías, detalle con 404 y `logout`.
  - `catalogQuery.test.ts`: valores por defecto, filtros, valores inválidos, booleanos, rango, ida y vuelta por la URL y conteo de filtros.
  - `imageValidation.test.ts`: `validateImageFile` y los formatters nuevos.
  - `sellerProductsSlice.test.ts`: los thunks nuevos `adjustStock` (con 409 y relectura), `setDiscount`, `removeDiscount`, `toggleActive` (con `togglingIds`) y ahora `reorderImages` y `deleteImage` (con relectura tras 400/404). `uploadImage` se prueba en `ProductImagesDialog.test.tsx`, junto con el `serializableCheck`.
  - De componentes y rutas: `routes.test.tsx`, `sharedComponents.test.tsx`, `dialogs.test.tsx`, `ProductImagesDialog.test.tsx`, `CatalogPage.test.tsx`, `ProductDetailPage.test.tsx` y `errorMessages.test.ts`.
- **Archivos:** `features/seller/sellerProductsSlice.test.ts`.
- **Verificación:** `npm test` 101/101 ✅ (12 archivos) · lint ✅ · build ✅.
- **Criterios de la §17:** tests, lint y build sin errores en el frontend; Redux DevTools muestra `pending/fulfilled/rejected` de los thunks nuevos (todos son `createAsyncThunk` y los tests comprueban sus tres estados).

### Tarea 23: README y capturas

- **Hecho:**
  - **README del frontend:** usuarios de prueba, roles y rutas, slices nuevos, vistas del vendedor y del comprador, errores y verificación.
  - **README del backend:** endpoints 1.1.0 con roles, ejemplos `curl` (stock, descuento, imagen y catálogo), seguridad (roles, límites, imágenes), estructura y decisiones; la sección de base vacía, seed y credenciales ya estaba desde la tarea 10.
  - **README de la raíz:** descripción, `npm run seed`, credenciales y enlaces a la spec 03 y a este log.
  - **Capturas:** 12 nuevas en `frontend/docs/screenshots/`, tomadas de la app real con Chrome sin interfaz controlado por CDP (script fuera del repo, sin dependencias nuevas), con el backend sembrado: catálogo y filtros a 1280/360 px, detalle, tabla del vendedor a 1280/360 px, diálogos de imágenes, descuento y stock, registro con rol y aviso del comprador. Se quitaron las 4 capturas de la 1.0 que ya no representaban la app; se conserva la del login.
- **Archivos:** `frontend/README.md`, `backend/README.md`, `README.md`, `frontend/docs/screenshots/*.png`.
- **Verificación:** mientras se tomaban las capturas se midió en el navegador:
  - las 10 imágenes visibles de `http://localhost:3001/uploads/...` cargan desde `http://localhost:5173` (`naturalWidth > 0`);
  - a 1280 px el catálogo tiene 4 columnas y el panel de filtros visible;
  - a 360 px tiene 2 columnas, el panel oculto (filtros en el panel lateral) y sin desborde horizontal;
  - un comprador en `/seller/products` termina en `/catalog` con el aviso.
- **Criterios de la §17:**
  - Las imágenes subidas cargan desde `localhost:5173`.
  - A 360 px, 2 columnas y filtros en panel lateral; a 1280 px, panel fijo y 4 columnas.
  - Un comprador que escribe `/seller/products` termina en `/catalog` con aviso.


## Fase 2 – Verificación final contra el contrato

### 1. `docs/openapi.json`

`npm run docs:export` regenera el archivo sin cambios respecto del commit de la tarea 12, e `info.version` es **`1.1.0`**.

### 2. OpenAPI vs. contrato §2 (comparación automática de las tablas del markdown con `openapi.json`)

| Método | Ruta | Éxito (contrato / OpenAPI) | Errores del contrato | Errores en OpenAPI | 429 documentado | Resultado |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | 201 / 201 | 400, 409 | 400, 409 | sí | ✅ |
| POST | `/auth/login` | 200 / 200 | 400, 401 | 400, 401 | sí | ✅ |
| GET | `/auth/me` | 200 / 200 | 401 | 401 | sí | ✅ |
| GET | `/products` | 200 / 200 | 400, 401 | 400, 401 | sí | ✅ |
| GET | `/products/categories` | 200 / 200 | 401 | 401 | sí | ✅ |
| GET | `/products/:id` | 200 / 200 | 400, 401, 404 | 400, 401, 404 | sí | ✅ |
| GET | `/seller/products` | 200 / 200 | 400, 401, 403 | 400, 401, 403 | sí | ✅ |
| GET | `/seller/products/:id` | 200 / 200 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |
| POST | `/seller/products` | 201 / 201 | 400, 401, 403, 409 | 400, 401, 403, 409 | sí | ✅ |
| PATCH | `/seller/products/:id` | 200 / 200 | 400, 401, 403, 404, 409 | 400, 401, 403, 404, 409 | sí | ✅ |
| DELETE | `/seller/products/:id` | 204 / 204 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |
| POST | `/seller/products/:id/stock-adjustments` | 200 / 200 | 400, 401, 403, 404, 409 | 400, 401, 403, 404, 409 | sí | ✅ |
| PUT | `/seller/products/:id/discount` | 200 / 200 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |
| DELETE | `/seller/products/:id/discount` | 200 / 200 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |
| POST | `/seller/products/:id/images` | 201 / 201 | 400, 401, 403, 404, 409, 413, 415 | 400, 401, 403, 404, 409, 413, 415 | sí | ✅ |
| DELETE | `/seller/products/:id/images/:imageId` | 200 / 200 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |
| PUT | `/seller/products/:id/images/order` | 200 / 200 | 400, 401, 403, 404 | 400, 401, 403, 404 | sí | ✅ |

Contrato: 17 endpoints · OpenAPI: 17 operaciones · Diferencias: 0 · info.version: 1.1.0

El 429 se compara aparte porque el contrato lo admite en cualquier endpoint ("Cualquier endpoint puede devolver además `429`"). Está documentado en los 17.

### 3. `frontend/src/types/` vs. contrato §3

Se extrajo el bloque TypeScript del contrato §3 y se comparó cada tipo con el del frontend, con el compilador (`Equal<A, B>` estricto, en ambos sentidos): **los 21 tipos son idénticos**.

Tipos comparados: `UserRole`, `User`, `RegisterRequest`, `LoginRequest`, `LoginResponse`, `ProductImage`, `SellerSummary`, `Product`, `CreateProductRequest`, `UpdateProductRequest`, `StockAdjustmentRequest`, `DiscountRequest`, `ReorderImagesRequest`, `SortOrder`, `SellerProductSortField`, `CatalogSortField`, `SellerProductsQuery`, `CatalogQuery`, `PaginationMeta`, `PaginatedResponse`, `ApiError`.

Como control, un tipo alterado a propósito (`User` sin `role`) hace fallar la comprobación.

### 4. Recorrido real con la base vacía

1. Se borró `productos_db` con un script de Node (D18) y se ejecutó `npm run seed`.
2. Se levantó la API (`node dist/main.js`, puerto 3001) y se recorrió con un script que guarda cada comando `curl` equivalente y su respuesta en [`verificacion-1.1.0.md`](verificacion-1.1.0.md): **58 pasos ✅, 0 ❌**.

El recorrido cubre:
- registro de vendedor y comprador (y registro sin rol → 400);
- CRUD, stock, descuento e imágenes como vendedor;
- 403 del comprador en `/seller/...`;
- 404 al leer, editar, ajustar o subir imágenes a un producto de otro vendedor;
- 413 con 1 048 577 bytes y 415 con un `.txt` renombrado a `.png`;
- 400 sin archivo y con el campo `file`;
- la imagen servida con CORP `cross-origin`;
- el catálogo con cada filtro (incluido `onSale=false`, que devuelve el mismo total que sin filtro), categorías y un oculto con 404;
- el borrado del producto con sus archivos.

Que una imagen subida se ve desde `http://localhost:5173` se comprobó en Chrome (tarea 23): las 10 imágenes visibles del catálogo cargan con `naturalWidth > 0` en esa página.

Además, en Chrome:
- con el formulario real de login, el vendedor llega a `/seller/products` y la compradora a `/catalog`;
- en Swagger UI, "Try it out" de la subida muestra un `input[type=file]` para `image *`.

### 5. Correcciones

No apareció ningún ❌ en los puntos 2 a 4. Solo se cambió el `console.log` de `scripts/export-openapi.ts` (de la 1.0) por `Logger`, por la regla del instructivo.

### 6. Criterios de aceptación de la spec 03 §17

**Roles**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Registrarse sin `role` o con otro valor → 400 | ✅ | e2e `register without role or with an unknown role returns 400`; recorrido "Registro sin rol → 400" |
| 2 | `GET /auth/me` incluye `role` | ✅ | e2e `GET /auth/me returns the user with its role…`; recorrido |
| 3 | Un comprador en cualquier `/seller/...` → 403 | ✅ | e2e `a buyer gets 403 "Forbidden" on every one of the 11 seller endpoints`; recorrido (3 pasos) |
| 4 | Vendedor con un producto ajeno (ver, editar, ajustar, subir imágenes) → 404 | ✅ | e2e (pruebas "another seller gets 404" en los bloques Seller products, Stock, Discounts e Images); recorrido (4 pasos) |
| 5 | `sellerId` en el body de crear o editar → 400 | ✅ | e2e `sending sellerId (or any computed field) on create or edit returns 400`; recorrido |

**Productos del vendedor**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 6 | `GET /seller/products` solo devuelve los suyos, incluidos los ocultos | ✅ | e2e "returns only the seller's products, hidden ones included"; unitario `findSellerProducts` |
| 7 | Dos vendedores pueden usar el mismo SKU; el mismo, no (409) | ✅ | e2e `the same seller cannot repeat a sku (409), another seller can`; recorrido |
| 8 | `PATCH` con `stock` → 400 | ✅ | e2e `PATCH with stock returns 400…`; recorrido |
| 9 | Salida mayor al stock → 409 sin cambios | ✅ | e2e `a decrease above the current stock returns 409 and changes nothing`; recorrido |
| 10 | Diez salidas simultáneas de 1 sobre stock 5 → 0, nunca negativo | ✅ | e2e `ten simultaneous decreases…` contra MongoDB real (cinco 200, cinco 409, stock 0) |
| 11 | 15 % sobre 145 000 → `finalPrice: 123250` | ✅ | unitario `pricing.spec.ts`; e2e; recorrido |
| 12 | Cambiar el precio con descuento recalcula `finalPrice` | ✅ | e2e (30 000 con 10 % → 27 000); recorrido (100 000 con 15 % → 85 000) |
| 13 | Descuento de 0 o de 91 → 400 | ✅ | e2e `a discount of 0, 91 or a decimal returns 400`; recorrido |

**Imágenes**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 14 | JPEG de ~900 KB → 201 con `url`/`thumbUrl` que cargan desde `localhost:5173` | ✅ | e2e (JPEG de ~910 KB, CORP `cross-origin`); recorrido (913 kB); Chrome en `localhost:5173`: 10/10 imágenes cargadas |
| 15 | 1 048 577 bytes → 413 | ✅ | e2e; recorrido |
| 16 | `.txt` renombrado a `.png` → 415 | ✅ | e2e; recorrido; unitario `ImageFilePipe` |
| 17 | La sexta imagen → 409 | ✅ | e2e `the sixth image returns 409`, y la concurrencia del último lugar (201 + 409 sin archivos huérfanos) |
| 18 | Sin archivo → 400 `"Image is required"`; campo `file` → 400 `"Unexpected file field - file"`; dos archivos → 400 | ✅ | e2e `malformed uploads return 400…`; recorrido (mensaje real de Multer 2, D3) |
| 19 | Comprador o sin token → 403/401 sin que Multer lea el archivo | ✅ | e2e (con un archivo `text/plain`, que Multer habría rechazado con 415 si lo leyera, responde 401/403) |
| 20 | En Swagger la subida muestra un selector de archivo | ✅ | Chrome sobre `/api/docs` ("Try it out" muestra `input[type=file]`); `openapi.json` con `multipart/form-data` y `format: binary` |
| 21 | Imágenes guardadas en WebP sin EXIF | ✅ | e2e `stored images are WebP and keep no EXIF metadata`; unitario `ImageProcessingService` |
| 22 | Eliminar un producto borra sus archivos | ✅ | e2e `deleting the product removes all its files from uploads/`; recorrido (la URL pasa a 404) |

**Catálogo**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 23 | No devuelve ocultos, y su detalle → 404 | ✅ | e2e `lists only active products…` y `a hidden product answers 404…`; recorrido |
| 24 | `minPrice`/`maxPrice` sobre precio final; `minPrice > maxPrice` → 400 | ✅ | e2e (filtros) y unitario del DTO; recorrido |
| 25 | `onSale=false` no filtra | ✅ | e2e `onSale=false does not filter…`; unitario del DTO; recorrido (mismo total) |
| 26 | Incluye `seller.name` y no el email | ✅ | e2e `includes seller.name and never the seller email`; recorrido (sin `@` en la respuesta) |
| 27 | `search=.*` busca el texto literal | ✅ | e2e; unitarios `buildSearchRegex`/`escapeRegExp` (con prueba de ReDoS); recorrido |

**Frontend**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 28 | Login del vendedor → `/seller/products`; del comprador → `/catalog` | ✅ | Chrome con el formulario real de login; `routes.test.tsx` (redirección de `/`) |
| 29 | Un comprador que escribe `/seller/products` termina en `/catalog` con aviso | ✅ | `routes.test.tsx`; Chrome (captura `buyer-forbidden-notice.png`) |
| 30 | Stock, descuento, ocultar y subir imágenes actualizan la fila sin recargar la tabla | ✅ | `sellerProductsSlice.test.ts` (`api.list` no se llama); `ProductImagesDialog.test.tsx` |
| 31 | Una imagen de 2 MB muestra el error sin hacer ninguna petición | ✅ | `ProductImagesDialog.test.tsx` (`uploadImage` no se llama) |
| 32 | Barra de progreso por archivo | ✅ | `ProductImagesDialog.test.tsx` (dos `progressbar`, `aria-valuenow` 40) |
| 33 | Los filtros se reflejan en la URL; al recargar o compartir se ven los mismos resultados | ✅ | `CatalogPage.test.tsx` (una URL con filtros llega igual al API; cada control escribe la URL) |
| 34 | A 360 px, 2 columnas y filtros en panel lateral; a 1280 px, panel fijo y 4 columnas | ✅ | Chrome: 360 px → 2 columnas, panel `display: none`, sin desborde; 1280 px → 4 columnas y panel visible; capturas |
| 35 | Las tarjetas agotadas muestran "Agotado" | ✅ | `CatalogPage.test.tsx`; captura `catalog-desktop.png` |
| 36 | Redux DevTools muestra `pending/fulfilled/rejected` de los thunks nuevos | ✅ | Todos son `createAsyncThunk` y los tests comprueban sus tres estados. No se abrió la extensión DevTools en un navegador |

**Calidad**

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 37 | `openapi.json` en 1.1.0 con el `multipart/form-data` | ✅ | `info.version: 1.1.0`; comparación del punto 2 |
| 38 | `api-contract.md` en 1.1.0 | ✅ | Versión 1.1.0, con las aclaraciones de la fase 0 en §10 |
| 39 | Con la base vacía, `npm run seed` crea los datos y se puede repetir | ✅ | Base borrada + seed (punto 4); dos ejecuciones seguidas en la tarea 10 (3 usuarios, 30 productos, 31 imágenes) |
| 40 | Tests, lint y build sin errores | ✅ | Backend: `npm test` 102/102, `test:e2e` 82/82, lint y build ✅. Frontend: `npm test` 101/101, lint y build ✅ |

No queda ningún criterio sin cumplir.

### 7. Specs 01/02 y README

- **Specs 01 y 02:** encabezado con estado "implementada (1.0.0) y ampliada por la spec 03 (1.1.0)" y una tabla "Cambios en la versión 1.1.0", sección por sección. No se reescribe el texto de la 1.0, que documenta la respuesta a los ejercicios 1 y 2.
- **Spec 03:** estado "implementada".
- **README** (raíz, backend y frontend): actualizados en la tarea 23 (roles, credenciales, base vacía, seed, endpoints y capturas nuevas).

## Cambio posterior: imágenes en MongoDB y máximo 4 por producto (D19)

Las tareas 8, 9 y 10 y la verificación de la fase 2 describen el almacenamiento en disco tal como se implementó primero. Este cambio solo modifica dónde se guardan las imágenes y cuántas caben; el resto de la spec 03 sigue igual.

- **Hecho:**
  - **Schema:** `ProductImage` cambia `key` por `mimeType`, `data` y `thumbData` (base64, `select: false`). `MAX_PRODUCT_IMAGES = 4`, y el `$push` condicional usa `'images.3': { $exists: false }`. Los productos se leen con `WITHOUT_IMAGE_DATA` en todas las consultas (listados, detalle, escrituras que devuelven el producto y lecturas previas de la subida, el borrado y el reordenamiento).
  - **Servicio:** `addImage` pasa los buffers de `sharp` a base64 y arma las URLs con `PUBLIC_BASE_URL` (`image-urls.ts`). Borrar un producto es un `deleteOne`, y borrar una imagen, un `$pull`: ya no hay limpieza de archivos. Reordenar usa un *update pipeline* (`$map` + `$filter` sobre los subdocumentos guardados). `findImageContent` proyecta solo la versión pedida de una imagen de un producto activo.
  - **Endpoint público:** `ProductImagesController` con `GET /products/:id/images/:imageId` y `.../thumb`, sin JWT y con `@SkipThrottle()`. Responde un `StreamableFile` `image/webp` con `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` y `Cross-Origin-Resource-Policy: cross-origin`. Documentado en Swagger (tag `Catalog`: respuesta 200 binaria, 400 y 404 con ejemplos).
  - **Se quitan:** el módulo `storage` (`StorageService`, `LocalDiskStorage` y su test), la ruta estática `/uploads` de `app.setup.ts`, `UPLOADS_DIR` (validación, `.env.example`, config e2e) y la limpieza de `uploads/` en el seed. `.gitignore` conserva `uploads/` para que no se suban copias viejas que queden en local.
  - **Seed:** genera el `_id` de cada producto antes de insertarlo (las URLs lo necesitan), guarda las imágenes en base64 y nunca pasa de 4 por producto.
  - **Frontend:** `MAX_PRODUCT_IMAGES = 4` (contador "X de 4" y la zona de carga se desactiva en 4) y el texto "Este producto ya tiene 4 imágenes.". Los tipos y la capa de API no cambian.
  - **Documentos:** spec 03 (§2, §5.2, §7, §10, §13.4, §14–17, §19 y una nota en la tarea 8), contrato (§1, §2.2, §4.5, §5.3, §6.2, §8 y §10, sin cambio de versión), `docs/openapi.json`, README del backend y tabla de cambios de la spec 01.
- **Archivos:** `products/schemas/product-image.schema.ts`, `products/schemas/product.schema.ts`, `products/products.service.ts` (+ spec), `products/product-images.controller.ts` (nuevo), `products/image-urls.ts` (nuevo), `products/product-view.ts`, `products/products.module.ts`, `products/seller-products.controller.ts`, `products/dto/product-response.dto.ts`, `images/image-processing.service.ts`, `app.setup.ts`, `main.ts`, `config/env.validation.ts` (+ spec), `config/swagger.config.ts`, `scripts/seed.ts`, `test/app.e2e-spec.ts`, `vitest.config.e2e.ts`, `.env.example`; se elimina `modules/storage/`. Frontend: `utils/imageValidation.ts`, `utils/errorMessages.ts` (+ test), `features/seller/components/{ImageDropzone,ProductImagesDialog}.tsx`, `ProductImagesDialog.test.tsx` y URLs de ejemplo en otros dos tests.
- **Verificación:**
  - Backend: `npm test` 100/100 ✅ · `npm run test:e2e` 85/85 ✅ · lint ✅ · build ✅ · `docs:export` ✅ (`info.version` 1.1.0, 19 operaciones).
  - Frontend: `npm test` 101/101 ✅ · lint ✅ · build ✅.
  - `npm run seed` contra una base temporal (borrada después): 3 usuarios, 30 productos, 31 imágenes, como máximo 2 por producto; el documento más grande pesa unos 27 KB.
- **Criterios de la §17 (actualizados):**
  - Un JPEG de ~900 KB devuelve 201, y `url` y `thumbUrl` cargan sin token, en WebP, con caché `immutable`, `nosniff` y CORP `cross-origin`.
  - La quinta imagen devuelve 409 `"Image limit reached"`, y dos subidas simultáneas por el último lugar dan 201 + 409.
  - Las imágenes se guardan en base64 en el documento (se comprueba leyendo la colección directamente), y ningún listado, detalle ni escritura del vendedor o del catálogo devuelve ese base64.
  - La imagen de un producto oculto responde 404 y vuelve a servirse al activarlo; una imagen inexistente responde 404 y un id inválido, 400.
  - Reordenar conserva los datos de cada imagen (cada URL sigue sirviendo su imagen), y borrar una imagen o el producto deja sus URLs en 404.
- **Notas:**
  - Una base de desarrollo sembrada antes de este cambio tiene imágenes con `key` y sin `data`: sus URLs viejas (`/uploads/...`) ya no existen. Hay que volver a ejecutar `npm run seed`.
  - `select: false` en `data`/`thumbData` es una red de seguridad: las consultas igual declaran la proyección, como pide el cambio. El endpoint público usa una agregación, que no aplica `select: false`.

## Corrección: la subida desde el navegador respondía "No se pudo subir la imagen."

- **Causa:** `api/client.ts` (desde la tarea 13) fijaba `Content-Type: application/json` en la instancia de axios. Con ese header, axios 1.x convierte un `FormData` en JSON, así que la subida enviaba `{"image":{}}` sin archivo, el backend respondía 400 `"Image is required"` y el frontend lo mostraba como "No se pudo subir la imagen.". No dependía del cambio D19. Los tests no lo veían porque simulan `productsApi`, y los e2e del backend suben con supertest.
- **Hecho:** la instancia ya no fija `Content-Type`. Axios pone `application/json` en los cuerpos que son objetos y deja que el navegador ponga `multipart/form-data` con su `boundary`, como pide la spec 03 §13.3.
- **Archivos:** `frontend/src/api/client.ts`, `frontend/src/api/productsApi.test.ts` (nuevo: comprueba, con el adaptador de axios, que la subida sale como `FormData` con el archivo y que los cuerpos JSON siguen saliendo como `application/json`; falla con el código anterior).
- **Verificación:** frontend `npm test` 103/103 ✅ · lint ✅ · build ✅.

## Cambio posterior: imágenes que rotan en el catálogo y sin "Hacer principal"

- **Hecho:**
  - **`ProductCard`:** con más de una imagen las rota cada 3 segundos con un fundido y muestra puntos de posición. Se pausa con el puntero o el foco encima y no rota con `prefers-reduced-motion`. Solo la imagen visible tiene `alt`. La lógica está en el hook `useRotatingIndex`.
  - **`ProductImagesDialog`:** se quita "Hacer principal". La etiqueta "Principal" sigue en la primera imagen. El thunk `reorderImages`, `productsApi.reorderImages` y el endpoint `PUT /images/order` se conservan (contrato sin cambios), aunque la interfaz ya no los usa.
  - **Spec 03:** §6.3, §13.4, §13.5, §17, §18 (nota en la tarea 17) y §19.
- **Archivos:** `features/catalog/useRotatingIndex.ts` (nuevo), `features/catalog/components/ProductCard.tsx`, `features/catalog/components/ProductCard.test.tsx` (nuevo), `features/seller/components/ProductImagesDialog.tsx` (+ test).
- **Verificación:** frontend `npm test` 107/107 ✅ · lint ✅ · build ✅. El backend no cambia.

## Cambio posterior: el vendedor no ve el catálogo

- **Hecho:** `/catalog` y `/catalog/:id` quedan dentro de `ProtectedRoute roles={['buyer']}`. Un vendedor que entra ahí vuelve a su inicio, `/seller/products`, con "No tienes acceso a esa sección." (el mismo mecanismo que ya llevaba al comprador fuera de `/seller/products`). La barra superior del vendedor solo muestra "Mis productos". Su pantalla de inicio ya era "Mis productos" (`HOME_PATHS`), también después del login.
- **Alcance:** solo el frontend. La API del catálogo sigue aceptando a cualquier usuario autenticado (contrato sin cambios), porque solo expone datos públicos; restringirla con `@Roles('buyer')` sería un cambio incompatible del contrato.
- **Documentos:** spec 03 §4 (nota en la tabla de permisos), §13.1 y §17; README del frontend.
- **Archivos:** `app/routes.tsx`, `components/AppLayout.tsx`, `app/routes.test.tsx` (vendedor en `/catalog` y en el detalle → `/seller/products` con aviso; enlaces de la barra por rol).
- **Verificación:** frontend `npm test` 108/108 ✅ · lint ✅ · build ✅.

## Cambio posterior: imágenes del seed dentro de `products.json`

- **Hecho:** cada producto de `seed/products.json` trae un arreglo `images` con los campos que se guardan en MongoDB (`mimeType`, `data`, `thumbData`, `width`, `height`), en base64 y ya procesados a WebP con `ImageProcessingService`. Son 31 imágenes con las mismas reglas de antes: una por categoría, una de "detalle" en 4 productos y ninguna en los 3 sin empaque. El seed solo agrega `_id`, `url` y `thumbUrl`, porque dependen de los ids que genera. Se borró `seed/images/`.
- **Por qué:** que el JSON sea la única fuente de los datos de prueba, para que quien clone el proyecto cargue productos con imágenes sin depender de archivos aparte. El seed ya no usa sharp. `products.json` pasa de 12 KB a unos 390 KB.
- **Documentos:** spec 03 §14 y §16; README del backend.
- **Archivos:** `src/scripts/seed.ts`, `seed/products.json`, `seed/images/*.jpg` (borrados).
