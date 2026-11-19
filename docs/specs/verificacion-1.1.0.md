# Recorrido real de la API 1.1.0

Fecha: 2026-11-19T00:29:03.882Z · Base vacía + `npm run seed` · API en `http://localhost:3001/api/v1`.

Resultado: **58 ✅ / 0 ❌**.

Cada paso muestra el comando `curl` equivalente (`$TOKEN` es el del usuario que corresponde), el código esperado y la respuesta real (recortada a 400 caracteres).

## 1. Registro de vendedor y comprador

### ✅ Registro de vendedor

```bash
curl -X POST "http://localhost:3001/api/v1/auth/register" -H "Content-Type: application/json" -d '{"email":"dana.mwmtbemd@prueba.com","password":"Clave1234","name":"Dana Vendedora","role":"seller"}'
```

Esperado: **201** · Recibido: **201** · role seller, sin password

```json
{"_id":"6afe42ce888e2c7a0d3fe29e","email":"dana.mwmtbemd@prueba.com","name":"Dana Vendedora","role":"seller","createdAt":"2026-11-19T00:29:02.060Z","updatedAt":"2026-11-19T00:29:02.060Z"}
```

### ✅ Registro de comprador

```bash
curl -X POST "http://localhost:3001/api/v1/auth/register" -H "Content-Type: application/json" -d '{"email":"eva.mwmtbemd@prueba.com","password":"Clave1234","name":"Eva Compradora","role":"buyer"}'
```

Esperado: **201** · Recibido: **201** · role buyer

```json
{"_id":"6afe42ce888e2c7a0d3fe29f","email":"eva.mwmtbemd@prueba.com","name":"Eva Compradora","role":"buyer","createdAt":"2026-11-19T00:29:02.306Z","updatedAt":"2026-11-19T00:29:02.306Z"}
```

### ✅ Registro sin rol → 400

```bash
curl -X POST "http://localhost:3001/api/v1/auth/register" -H "Content-Type: application/json" -d '{"email":"sin.rol.mwmtbemd@prueba.com","password":"Clave1234","name":"Sin Rol"}'
```

Esperado: **400** · Recibido: **400** · mensaje de role

```json
{"statusCode":400,"error":"Bad Request","message":["role must be one of the following values: seller, buyer"],"path":"/api/v1/auth/register","timestamp":"2026-11-19T00:29:02.312Z"}
```

### ✅ Login del vendedor

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"dana.mwmtbemd@prueba.com","password":"Clave1234"}'
```

Esperado: **200** · Recibido: **200**

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlNDJjZTg4OGUyYzdhMGQzZmUyOWUiLCJlbWFpbCI6ImRhbmEubXdtdGJlbWRAcHJ1ZWJhLmNvbSIsInJvbGUiOiJzZWxsZXIiLCJpYXQiOjE3OTUwNDgxNDIsImV4cCI6MTc5NTA1MTc0Mn0.rMo70N3iNKLl6C-tsCLbQpElkYha_Rvp8GBdpnrV6G0","tokenType":"Bearer","expiresIn":3600}
```

### ✅ Login del comprador

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"eva.mwmtbemd@prueba.com","password":"Clave1234"}'
```

Esperado: **200** · Recibido: **200**

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlNDJjZTg4OGUyYzdhMGQzZmUyOWYiLCJlbWFpbCI6ImV2YS5td210YmVtZEBwcnVlYmEuY29tIiwicm9sZSI6ImJ1eWVyIiwiaWF0IjoxNzk1MDQ4MTQyLCJleHAiOjE3OTUwNTE3NDJ9.XN2K80E76bqoUxQTlRTWD8lTJPra6in3BIk0UcXgS9Y","tokenType":"Bearer","expiresIn":3600}
```

### ✅ GET /auth/me incluye role

```bash
curl -X GET "http://localhost:3001/api/v1/auth/me" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · role: seller

```json
{"_id":"6afe42ce888e2c7a0d3fe29e","email":"dana.mwmtbemd@prueba.com","name":"Dana Vendedora","role":"seller","createdAt":"2026-11-19T00:29:02.060Z","updatedAt":"2026-11-19T00:29:02.060Z"}
```

## 2. CRUD, stock, descuento e imágenes como vendedor

### ✅ Crear producto

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50"}'
```

Esperado: **201** · Recibido: **201** · finalPrice = price, sin descuento, sin imágenes, seller.name; sin sellerId

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.802Z"}
```

### ✅ Mis productos: solo el creado (Ana ya tiene FER-NPK-50 en el seed y Dana pudo usar el mismo SKU)

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · mis productos: 1

```json
{"data":[{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.802Z"}],"meta":{"page":1,"limit":10,…
```

### ✅ Mismo SKU del mismo vendedor → 409

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Otro","price":1,"stock":1,"sku":"FER-NPK-50"}'
```

Esperado: **409** · Recibido: **409** · SKU already exists

```json
{"statusCode":409,"error":"Conflict","message":"SKU already exists","path":"/api/v1/seller/products","timestamp":"2026-11-19T00:29:02.822Z"}
```

### ✅ Crear con sellerId en el body → 400

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Otro","price":1,"stock":1,"sku":"OTRO-1","sellerId":"6739f2a1c4e5b8a9d0f12345"}'
```

Esperado: **400** · Recibido: **400** · property sellerId should not exist

```json
{"statusCode":400,"error":"Bad Request","message":["property sellerId should not exist"],"path":"/api/v1/seller/products","timestamp":"2026-11-19T00:29:02.829Z"}
```

### ✅ Detalle propio

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200**

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.802Z"}
```

### ✅ PATCH de descripción y categoría

```bash
curl -X PATCH "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"description":"Bulto de 50 kg","category":"Fertilizantes"}'
```

Esperado: **200** · Recibido: **200** · descripción guardada

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":40,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.840Z"}
```

### ✅ PATCH con stock → 400

```bash
curl -X PATCH "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"stock":95}'
```

Esperado: **400** · Recibido: **400** · property stock should not exist

```json
{"statusCode":400,"error":"Bad Request","message":["property stock should not exist"],"path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0","timestamp":"2026-11-19T00:29:02.848Z"}
```

### ✅ Entrada de 5 unidades

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/stock-adjustments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"increase","quantity":5}'
```

Esperado: **200** · Recibido: **200** · stock 45

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.852Z"}
```

### ✅ Salida mayor al stock → 409

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/stock-adjustments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"decrease","quantity":100}'
```

Esperado: **409** · Recibido: **409** · Insufficient stock

```json
{"statusCode":409,"error":"Conflict","message":"Insufficient stock","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/stock-adjustments","timestamp":"2026-11-19T00:29:02.860Z"}
```

### ✅ El stock no cambió

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · stock sigue en 45

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":145000,"discountPercent":0,"finalPrice":145000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.852Z"}
```

### ✅ Descuento de 15 % sobre 145 000

```bash
curl -X PUT "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"percent":15}'
```

Esperado: **200** · Recibido: **200** · finalPrice 123250

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":145000,"discountPercent":15,"finalPrice":123250,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.867Z"}
```

### ✅ Cambiar el precio recalcula finalPrice

```bash
curl -X PATCH "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"price":100000}'
```

Esperado: **200** · Recibido: **200** · finalPrice 85000

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":15,"finalPrice":85000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[],"seller":{"_id":"6afe42ce888e2c7a0d3fe29e","name":"Dana Vendedora"},"createdAt":"2026-11-19T00:29:02.802Z","updatedAt":"2026-11-19T00:29:02.872Z"}
```

### ✅ Descuento de 0 → 400

```bash
curl -X PUT "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"percent":0}'
```

Esperado: **400** · Recibido: **400**

```json
{"statusCode":400,"error":"Bad Request","message":["percent must not be less than 1"],"path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount","timestamp":"2026-11-19T00:29:02.878Z"}
```

### ✅ Descuento de 91 → 400

```bash
curl -X PUT "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"percent":91}'
```

Esperado: **400** · Recibido: **400**

```json
{"statusCode":400,"error":"Bad Request","message":["percent must not be greater than 90"],"path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount","timestamp":"2026-11-19T00:29:02.881Z"}
```

### ✅ Subir un JPEG de 892 KB

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN" -F "image=@cafe.jpg;type=image/jpeg"
```

Esperado: **201** · Recibido: **201** · url y thumbUrl WebP absolutas, sin key

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":15,"finalPrice":85000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a2","url":"http://localhost:3001/uploads/products/0267de53-1e34-4370-bab1-95bb85678747.webp","thumbUrl":"http://localhost:3001…
```

### ✅ Subir un PNG

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN"
```

Esperado: **201** · Recibido: **201** · 2 imágenes

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":15,"finalPrice":85000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a2","url":"http://localhost:3001/uploads/products/0267de53-1e34-4370-bab1-95bb85678747.webp","thumbUrl":"http://localhost:3001…
```

### ✅ La imagen se sirve sin token, con CORP cross-origin

```bash
curl -I "http://localhost:3001/uploads/products/0267de53-1e34-4370-bab1-95bb85678747_thumb.webp" -H "Origin: http://localhost:5173"
```

Esperado: **200** · Recibido: **200** · content-type image/webp, CORP cross-origin

```json
(image/webp, 47477 bytes)
```

### ✅ Reordenar (la segunda pasa a ser principal)

```bash
curl -X PUT "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images/order" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"imageIds":["6afe42cf888e2c7a0d3fe2a4","6afe42cf888e2c7a0d3fe2a2"]}'
```

Esperado: **200** · Recibido: **200** · nuevo orden

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":15,"finalPrice":85000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://localhost:3001…
```

### ✅ Archivo de 1 048 577 bytes → 413

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN" -F "image=@grande.jpg;type=image/jpeg"   # 1 048 577 bytes
```

Esperado: **413** · Recibido: **413** · File too large

```json
{"statusCode":413,"error":"Payload Too Large","message":"File too large","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.231Z"}
```

### ✅ .txt renombrado a .png → 415

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN" -F "image=@notas.png;type=image/png"   # un .txt renombrado
```

Esperado: **415** · Recibido: **415** · Unsupported file type

```json
{"statusCode":415,"error":"Unsupported Media Type","message":"Unsupported file type","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.238Z"}
```

### ✅ Sin archivo → 400

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN" -F "x="   # sin archivo
```

Esperado: **400** · Recibido: **400** · message: Image is required

```json
{"statusCode":400,"error":"Bad Request","message":"Image is required","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.244Z"}
```

### ✅ Sin cuerpo multipart → 400 "Image is required"

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN"
```

Esperado: **400** · Recibido: **400** · Image is required

```json
{"statusCode":400,"error":"Bad Request","message":"Image is required","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.251Z"}
```

### ✅ Campo llamado "file" → 400

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN" -F "file=@hoja.png;type=image/png"
```

Esperado: **400** · Recibido: **400** · Unexpected file field - file

```json
{"statusCode":400,"error":"Bad Request","message":"Unexpected file field - file","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.256Z"}
```

### ✅ Eliminar una imagen

```bash
curl -X DELETE "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images/6afe42cf888e2c7a0d3fe2a2" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 1 imagen

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":15,"finalPrice":85000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://localhost:3001…
```

### ✅ El archivo de la imagen eliminada ya no se sirve

```bash
curl -X GET "http://localhost:3001/uploads/products/0267de53-1e34-4370-bab1-95bb85678747.webp"
```

Esperado: **404** · Recibido: **404**

```json
(text/html; charset=utf-8, 197 bytes)
```

### ✅ Quitar el descuento

```bash
curl -X DELETE "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/discount" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · finalPrice = price

```json
{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":0,"finalPrice":100000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://localhost:3001…
```

## 3. 403 como comprador y 404 con un producto de otro vendedor

### ✅ Comprador en GET /seller/products → 403

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN"
```

Esperado: **403** · Recibido: **403** · Forbidden

```json
{"statusCode":403,"error":"Forbidden","message":"Forbidden","path":"/api/v1/seller/products","timestamp":"2026-11-19T00:29:03.276Z"}
```

### ✅ Comprador en POST /seller/products → 403

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"x"}'
```

Esperado: **403** · Recibido: **403**

```json
{"statusCode":403,"error":"Forbidden","message":"Forbidden","path":"/api/v1/seller/products","timestamp":"2026-11-19T00:29:03.279Z"}
```

### ✅ Comprador subiendo una imagen → 403

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images" -H "Authorization: Bearer $TOKEN"
```

Esperado: **403** · Recibido: **403**

```json
{"statusCode":403,"error":"Forbidden","message":"Forbidden","path":"/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0/images","timestamp":"2026-11-19T00:29:03.282Z"}
```

### ✅ Login de la vendedora del seed

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"ana.vendedora@correo.com","password":"Clave1234"}'
```

Esperado: **200** · Recibido: **200**

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlNDI4YTIwNzRmMWUyODE2OGI0NDciLCJlbWFpbCI6ImFuYS52ZW5kZWRvcmFAY29ycmVvLmNvbSIsInJvbGUiOiJzZWxsZXIiLCJpYXQiOjE3OTUwNDgxNDMsImV4cCI6MTc5NTA1MTc0M30.-TZX2YOpjvmJ3bBlOJRfBqjPH4oRDboTLbVoWhHT8_8","tokenType":"Bearer","expiresIn":3600}
```

### ✅ Un producto de Ana

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products?limit=1" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200**

```json
{"data":[{"_id":"6afe428a2074f1e28168b4a2","name":"Aspersor de impacto 1/2 pulgada","description":"Aspersor metálico con alcance de hasta 12 m para potreros y huertas.","price":23900,"discountPercent":0,"finalPrice":23900,"stock":3,"category":"Riego","sku":"RIE-ASP-12","isActive":true,"images":[{"_id":"6afe428a2074f1e28168b467","url":"http://localhost:3001/uploads/products/38bc2912-d40a-4435-8d31-…
```

### ✅ Dana lee el producto de Ana → 404

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products/6afe428a2074f1e28168b4a2" -H "Authorization: Bearer $TOKEN"
```

Esperado: **404** · Recibido: **404** · Product not found

```json
{"statusCode":404,"error":"Not Found","message":"Product not found","path":"/api/v1/seller/products/6afe428a2074f1e28168b4a2","timestamp":"2026-11-19T00:29:03.525Z"}
```

### ✅ Dana edita el producto de Ana → 404

```bash
curl -X PATCH "http://localhost:3001/api/v1/seller/products/6afe428a2074f1e28168b4a2" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Robado"}'
```

Esperado: **404** · Recibido: **404**

```json
{"statusCode":404,"error":"Not Found","message":"Product not found","path":"/api/v1/seller/products/6afe428a2074f1e28168b4a2","timestamp":"2026-11-19T00:29:03.530Z"}
```

### ✅ Dana ajusta el stock de Ana → 404

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe428a2074f1e28168b4a2/stock-adjustments" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"type":"decrease","quantity":1}'
```

Esperado: **404** · Recibido: **404**

```json
{"statusCode":404,"error":"Not Found","message":"Product not found","path":"/api/v1/seller/products/6afe428a2074f1e28168b4a2/stock-adjustments","timestamp":"2026-11-19T00:29:03.535Z"}
```

### ✅ Dana sube una imagen al producto de Ana → 404

```bash
curl -X POST "http://localhost:3001/api/v1/seller/products/6afe428a2074f1e28168b4a2/images" -H "Authorization: Bearer $TOKEN"
```

Esperado: **404** · Recibido: **404**

```json
{"statusCode":404,"error":"Not Found","message":"Product not found","path":"/api/v1/seller/products/6afe428a2074f1e28168b4a2/images","timestamp":"2026-11-19T00:29:03.540Z"}
```

## 4. Catálogo con cada filtro

### ✅ Catálogo sin filtros

```bash
curl -X GET "http://localhost:3001/api/v1/products?limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 28 activos, sin emails

```json
{"data":[{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":0,"finalPrice":100000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://local…
```

### ✅ onSale=false no filtra

```bash
curl -X GET "http://localhost:3001/api/v1/products?limit=48&onSale=false" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · total 28 = 28

```json
{"data":[{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":0,"finalPrice":100000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://local…
```

### ✅ onSale=true

```bash
curl -X GET "http://localhost:3001/api/v1/products?onSale=true&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 7 con descuento

```json
{"data":[{"_id":"6afe428a2074f1e28168b49a","name":"Café de origen Huila 500 g","description":"Café especial de tueste medio, cultivado en el Huila por pequeños productores.","price":32000,"discountPercent":10,"finalPrice":28800,"stock":120,"category":"Café","sku":"CAF-HUI-500","isActive":true,"images":[{"_id":"6afe428a2074f1e28168b464","url":"http://localhost:3001/uploads/products/51ac37f1-d76e-40…
```

### ✅ inStock=true

```bash
curl -X GET "http://localhost:3001/api/v1/products?inStock=true&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 26 con stock

```json
{"data":[{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":0,"finalPrice":100000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://local…
```

### ✅ category=Fertilizantes

```bash
curl -X GET "http://localhost:3001/api/v1/products?category=Fertilizantes&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 4 fertilizantes

```json
{"data":[{"_id":"6afe42ce888e2c7a0d3fe2a0","name":"Fertilizante NPK 15-15-15 50 kg","description":"Bulto de 50 kg","price":100000,"discountPercent":0,"finalPrice":100000,"stock":45,"category":"Fertilizantes","sku":"FER-NPK-50","isActive":true,"images":[{"_id":"6afe42cf888e2c7a0d3fe2a4","url":"http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp","thumbUrl":"http://local…
```

### ✅ minPrice y maxPrice sobre finalPrice

```bash
curl -X GET "http://localhost:3001/api/v1/products?minPrice=20000&maxPrice=50000&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 7 entre 20 000 y 50 000

```json
{"data":[{"_id":"6afe428a2074f1e28168b4a2","name":"Aspersor de impacto 1/2 pulgada","description":"Aspersor metálico con alcance de hasta 12 m para potreros y huertas.","price":23900,"discountPercent":0,"finalPrice":23900,"stock":3,"category":"Riego","sku":"RIE-ASP-12","isActive":true,"images":[{"_id":"6afe428a2074f1e28168b467","url":"http://localhost:3001/uploads/products/38bc2912-d40a-4435-8d31-…
```

### ✅ minPrice > maxPrice → 400

```bash
curl -X GET "http://localhost:3001/api/v1/products?minPrice=50000&maxPrice=20000" -H "Authorization: Bearer $TOKEN"
```

Esperado: **400** · Recibido: **400** · minPrice must not be greater than maxPrice

```json
{"statusCode":400,"error":"Bad Request","message":["minPrice must not be greater than maxPrice"],"path":"/api/v1/products","timestamp":"2026-11-19T00:29:03.598Z"}
```

### ✅ search=cafe (sin tildes)

```bash
curl -X GET "http://localhost:3001/api/v1/products?search=cafe&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 4 resultados con "Café"

```json
{"data":[{"_id":"6afe428a2074f1e28168b49d","name":"Café tostado Nariño 250 g","description":"Café de altura con notas cítricas, molido para filtro.","price":18500,"discountPercent":0,"finalPrice":18500,"stock":4,"category":"Café","sku":"CAF-NAR-250","isActive":true,"images":[{"_id":"6afe428a2074f1e28168b465","url":"http://localhost:3001/uploads/products/f554604a-6a2a-481a-aafc-ed50df2a40bc.webp","…
```

### ✅ search=.* busca el texto literal

```bash
curl -X GET "http://localhost:3001/api/v1/products?search=.*" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 0 resultados

```json
{"data":[],"meta":{"page":1,"limit":12,"total":0,"totalPages":0}}
```

### ✅ sortBy=finalPrice&order=asc

```bash
curl -X GET "http://localhost:3001/api/v1/products?sortBy=finalPrice&order=asc&limit=48" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · orden ascendente

```json
{"data":[{"_id":"6afe428a2074f1e28168b496","name":"Costal de fique para café 70 kg","description":"Empaque tradicional de fique para almacenar y transportar café pergamino.","price":7500.5,"discountPercent":0,"finalPrice":7500.5,"stock":300,"category":"Empaques","sku":"EMP-FIQUE-70","isActive":true,"images":[],"seller":{"_id":"6afe428a2074f1e28168b448","name":"Bruno Díaz"},"createdAt":"2026-11-09T…
```

### ✅ sortBy=discountPercent&order=desc

```bash
curl -X GET "http://localhost:3001/api/v1/products?sortBy=discountPercent&order=desc&limit=3" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · mayor descuento primero

```json
{"data":[{"_id":"6afe428a2074f1e28168b490","name":"Manguera de riego 1/2 pulgada x 100 m","description":"Manguera de polietileno para riego por goteo y conducción de agua en finca.","price":135000,"discountPercent":30,"finalPrice":94500,"stock":22,"category":"Riego","sku":"RIE-MANG-100","isActive":true,"images":[{"_id":"6afe428a2074f1e28168b45f","url":"http://localhost:3001/uploads/products/48a6c6…
```

### ✅ GET /products/categories

```bash
curl -X GET "http://localhost:3001/api/v1/products/categories" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200** · 12 categorías

```json
["Abonos orgánicos","Agroquímicos","Café","Cercas","Empaques","Enmiendas","Fertilizantes","Herramientas","Nutrición animal","Riego","Salud animal","Semillas"]
```

### ✅ Productos de Bruno (para un oculto)

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"bruno.vendedor@correo.com","password":"Clave1234"}'
```

Esperado: **200** · Recibido: **200**

```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YWZlNDI4YTIwNzRmMWUyODE2OGI0NDgiLCJlbWFpbCI6ImJydW5vLnZlbmRlZG9yQGNvcnJlby5jb20iLCJyb2xlIjoic2VsbGVyIiwiaWF0IjoxNzk1MDQ4MTQzLCJleHAiOjE3OTUwNTE3NDN9.fxO0Tt279aDviZz6tRXIwKTOEEIkBbYIejONtEGir7k","tokenType":"Bearer","expiresIn":3600}
```

### ✅ Lista de Bruno

```bash
curl -X GET "http://localhost:3001/api/v1/seller/products?limit=100" -H "Authorization: Bearer $TOKEN"
```

Esperado: **200** · Recibido: **200**

```json
{"data":[{"_id":"6afe428a2074f1e28168b4a4","name":"Tijera podadora profesional","description":"Tijera de poda con hoja de acero para frutales y café.","price":68000,"discountPercent":0,"finalPrice":68000,"stock":14,"category":"Herramientas","sku":"HER-TIJ-01","isActive":false,"images":[{"_id":"6afe428a2074f1e28168b468","url":"http://localhost:3001/uploads/products/3a575d79-2401-4519-8565-579b78bf3…
```

### ✅ Detalle de un producto oculto en el catálogo → 404

```bash
curl -X GET "http://localhost:3001/api/v1/products/6afe428a2074f1e28168b4a4" -H "Authorization: Bearer $TOKEN"
```

Esperado: **404** · Recibido: **404**

```json
{"statusCode":404,"error":"Not Found","message":"Product not found","path":"/api/v1/products/6afe428a2074f1e28168b4a4","timestamp":"2026-11-19T00:29:03.876Z"}
```

## 5. Eliminar el producto de prueba

### ✅ Eliminar el producto → 204

```bash
curl -X DELETE "http://localhost:3001/api/v1/seller/products/6afe42ce888e2c7a0d3fe2a0" -H "Authorization: Bearer $TOKEN"
```

Esperado: **204** · Recibido: **204**

```json

```

### ✅ Su imagen restante ya no se sirve

```bash
curl -X GET "http://localhost:3001/uploads/products/fb206847-cedc-4f20-8ac6-6d1b4d83d762.webp"
```

Esperado: **404** · Recibido: **404**

```json
(text/html; charset=utf-8, 197 bytes)
```
