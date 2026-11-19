# Uso de Inteligencia Artificial

## 1. Herramientas utilizadas

| Herramienta | Para qué se usó |
|---|---|
| Claude (Anthropic), modelo Claude Opus 5.5, en claude.ai | Preparar el entorno (MongoDB en Windows), definir el enfoque de trabajo y redactar la spec del backend. |
| Claude Code (Anthropic), extensión de VS Code | Implementar las tareas de las specs en código, escribir los tests, ajustar las specs, el registro de implementación, la verificación y los README. |

Claude Code trabajó con el archivo [`CLAUDE.md`](../../CLAUDE.md) en la raíz: describe la arquitectura, los comandos, la fuente de verdad (contrato > spec 03 > specs 01/02 > código) y reglas fijas como no hacer commits. Así cada sesión arranca con el mismo contexto sin repetirlo en cada prompt.

## 2. Enfoque: desarrollo guiado por specs

En lugar de pedirle a la IA "hazme una API de productos" en un solo prompt, se trabajó en dos fases:

1. **Definir antes de generar.** Primero se redactó con la IA una especificación (`docs/specs/01-backend.md`) con el modelo de datos, endpoints, formato de errores, reglas de seguridad, criterios de aceptación y una lista de tareas. Esa spec se revisó y ajustó manualmente antes de escribir código.
2. **Implementar por tareas.** Cada tarea de la spec se pidió por separado y se validó contra los criterios de aceptación antes de pasar a la siguiente.

Motivos:
- Las decisiones de diseño quedan escritas y justificadas, no improvisadas por la IA en cada prompt.
- Cada resultado se puede verificar contra criterios concretos.
- Prompts más cortos y acotados producen código más fácil de revisar.

El mismo esquema se repitió para el frontend ([spec 02](../specs/02-frontend.md)) y para la mejora de vendedores y compradores ([spec 03](../specs/03-mejoras-roles-vendedor-comprador.md)), con un [contrato de la API](../specs/api-contract.md) compartido entre las dos capas.

## 3. Prompts más relevantes

### 3.1 Elección del enfoque

> "¿Es buena idea hacer esta prueba técnica con specs o solo con prompts normales en .md?"

Resultado: se eligió un enfoque de specs ligeras (un archivo por ejercicio) en lugar de un framework completo de specs, para no agregar ceremonia innecesaria a una prueba de este tamaño.

### 3.2 Redacción de la spec del backend

> "Ayúdame a ir haciendo el .md del backend, mejor uno por uno."

Resultado: primera versión de `docs/specs/01-backend.md`.

> "El backend debe tener un Swagger con la documentación de las APIs, ten eso en cuenta también."

Resultado: se amplió la sección de Swagger con tags, DTOs de respuesta, documentación de errores, persistencia del token y exportación de `docs/openapi.json`, y se agregaron criterios de aceptación específicos.

### 3.3 Implementación

Los prompts largos se escribieron en un archivo (`instructivo.md`) y se le pidió a Claude Code que lo siguiera. Así el prompt se puede revisar y corregir antes de ejecutarlo.

**Estructura del repositorio.** El backend ya existía en otra carpeta; el prompt pedía armar el monorepo:

> "Crea la estructura base de un repositorio para una prueba técnica Full Stack. […] Copia el backend existente dentro de `backend/` SIN modificar su código. No copies `node_modules/`, `dist/` ni `.env`. […] `docker-compose.yml` con un único servicio `mongo` (imagen `mongo:7`, puerto 27017, volumen con nombre para persistir datos). Sin usuario ni contraseña, porque es solo para desarrollo local; agrega un comentario indicándolo."

**Tareas del backend y del frontend.** Plantilla usada para cada tarea:

> "Implementa la tarea N de `docs/specs/01-backend.md`. Respeta la estructura de carpetas de la sección 10 y las reglas de las secciones 6 y 7. No implementes nada fuera de esa tarea."

En el frontend se agregó que la IA explicara antes qué iba a tocar y cerrara con la verificación:

> "Continúa con la Tareas de `docs/specs/02-frontend.md`, siguiendo las mismas reglas de trabajo y respetando `docs/specs/api-contract.md` y el tema visual de la sección 14. Recuerda: solo esta tarea, primero dime qué archivos vas a tocar, explícame los slices/thunks si los tocas, y al final build + lint + criterios cubiertos + mensaje de commit."

**Spec 03 (vendedores y compradores).** El instructivo pedía:
- Una fase 0 que comparara el contrato, las specs y el código, y corrigiera los documentos antes de programar.
- Una entrada por tarea en el [registro de implementación](../specs/IMPLEMENTATION_LOG.md), con archivos, verificación y criterios cubiertos.
- Registrar como decisión (D1–D19) cada punto que los documentos no definían o en el que se contradecían.
- Reglas fijas: solo dependencias permitidas, sin `console.log` ni `TODO` sin explicar, textos de la interfaz exactos y no modificar el filtro global de errores.

**Documentación.** Para el README de la raíz el prompt pedía que todo comando, puerto, URL y usuario saliera de los archivos del repo, verificar cada enlace y reportar las inconsistencias en lugar de corregir otros archivos por su cuenta.

### 3.4 Cambios pedidos después de revisar la implementación

Después de probar la app se pidieron cambios que no estaban en la spec original. Cada uno quedó en el registro de implementación:
- Guardar las imágenes en base64 dentro de MongoDB en lugar de en disco, con un máximo de 4 por producto (D19).
- Rotar las imágenes en las tarjetas del catálogo y quitar "Hacer principal".
- Que el vendedor no vea el catálogo en el frontend.
- Que las imágenes del seed vayan dentro de `products.json`, para que quien clone el repo cargue los datos sin archivos aparte.

## 4. Cómo se validó el resultado

- **En cada tarea:** `npm test`, `npm run lint` y `npm run build` y, en el backend, también `npm run test:e2e`. El resultado de cada tarea está en el [registro de implementación](../specs/IMPLEMENTATION_LOG.md).
- **Tests e2e contra MongoDB real:** cubren los criterios de aceptación de las specs 01 §11 y 03 §17. Ahí están los casos negativos (sin token, precio negativo, campos extra, inyección de operadores de MongoDB, `id` inválido, `sku` duplicado, más de 5 logins por minuto) y lo que un mock no puede probar: diez salidas de stock simultáneas, dos subidas simultáneas por el último lugar de imagen y la subida real de archivos.
- **Recorrido real de la API:** con la base vacía y el seed, un script ejecutó 58 peticiones y guardó cada `curl` con su respuesta en [verificacion-1.1.0.md](../specs/verificacion-1.1.0.md): 58 ✅, 0 ❌.
- **OpenAPI contra el contrato:** se compararon automáticamente las tablas de endpoints del contrato con `docs/openapi.json`.
- **En el navegador:** las capturas se tomaron de la app real con Chrome sin interfaz y, en esa misma prueba, se midió que las imágenes cargan desde `localhost:5173`, el número de columnas a 360 y 1280 px, la redirección por rol y que la subida en Swagger muestra un selector de archivo.

## 5. Ajustes y correcciones

### 5.1 Decisiones propias sobre la propuesta de la IA
- **Instalación de MongoDB:** la IA sugirió Docker primero. Se descartó porque no estaba instalado en Windows y se optó por la instalación nativa.
- **Swagger:** la primera versión de la spec lo cubría de forma básica. Se pidió ampliarlo porque es un requisito explícito y la forma principal en que el evaluador probará la API.
- **Backend (spec 01 §13):** eliminación física, registro abierto para facilitar la evaluación y lecturas también protegidas con JWT.
- **Frontend (spec 02 §13):** token en `localStorage` (con la cookie `httpOnly` explicada en el ejercicio 5), `createAsyncThunk` en lugar de RTK Query, Tailwind + Headless UI en lugar de una librería de componentes y precios en pesos colombianos.
- **Spec 03 (§19):** mantener la versión 1.1.0 en `/api/v1` como excepción documentada, producto ajeno → 404 y catálogo con sesión obligatoria.

### 5.2 Errores o problemas del código y de las specs generadas

Formato: *qué generó la IA → cómo se detectó → cómo se corrigió*.

- **La subida de imágenes desde el navegador fallaba.** El cliente de axios fijaba `Content-Type: application/json`, así que el `FormData` se enviaba como JSON sin archivo → se vio al subir desde la app ("No se pudo subir la imagen."); los tests no lo detectaban porque simulaban la capa de API → se quitó el header y se agregó un test que comprueba, con el adaptador de axios, que la subida sale como `FormData`.
- **El precio final podía diferir entre backend y frontend.** La spec 03 calculaba el precio con `$round` de MongoDB, que redondea las mitades al par, mientras que JS las redondea hacia arriba → al implementar, con 0,05 y 30 % daban 0,04 y 0,03 → se calcula en centavos enteros con la misma fórmula en los dos lados ([D1](../specs/IMPLEMENTATION_LOG.md#decisiones)).
- **APIs de librerías desactualizadas en la spec:** `{ new: true }` (obsoleto en Mongoose 9) y *update pipelines* sin `updatePipeline: true`, que Mongoose 9 exige → al ejecutar → se corrigió la spec y se usó `returnDocument: 'after'`.
- **Mensajes y orden de errores que no coincidían con la realidad.** La spec decía `"Unexpected field"` y ponía el 404 antes del 415 en la subida → una prueba real devolvió `"Unexpected file field - file"`, y en Nest los pipes corren antes del método → se ajustaron el contrato y la spec en lugar de forzar el código ([D3 y D5](../specs/IMPLEMENTATION_LOG.md#decisiones)).
- **Contradicciones entre documentos:** la spec 02 pedía configurar ESLint cuando el stack era oxlint, y la spec 01 decía que la búsqueda no distinguía mayúsculas pero su criterio exigía ignorar tildes (`cafe` → `Café`) → se detectaron en la fase 0 → se corrigieron los documentos antes de programar.
- **`npm audit fix --force` rompía los tests:** bajaba Vitest y Vite de versión y fallaban la inyección de dependencias y la validación → quedó como regla en `CLAUDE.md`: mantener Vitest ≥ 4 y Vite ≥ 8.

## 6. Qué no se delegó a la IA

- La elección de las decisiones de diseño de la sección 13 de las specs.
- Los cambios de alcance después de probar la app (sección 3.5).
- La revisión de seguridad: que no haya secretos en el código, que `.env` esté en `.gitignore` y que los errores 500 no expongan detalles.
- Los commits: la IA deja los cambios sin confirmar y cada commit se revisa y se hace a mano.

## 7. Conclusión

La IA aceleró la configuración, la redacción de las specs y el código repetitivo (DTOs, decoradores de Swagger, estructura de módulos, tests). El valor estuvo en definir primero qué se quería, en verificar cada resultado contra criterios concretos y en dejar por escrito las decisiones, en lugar de aceptar el código tal como salía. Varios errores (la subida desde el navegador, el redondeo, las APIs desactualizadas) solo aparecieron al probar contra MongoDB real o en el navegador, no en los tests unitarios.
