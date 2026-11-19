# Spec 02 – Frontend: Gestión de Productos (React + Redux Toolkit)

> Estado: implementada (1.0.0) y ampliada por la [spec 03](03-mejoras-roles-vendedor-comprador.md) (1.1.0)
> Ejercicio: 2 de la prueba técnica Full Stack
> Consume la API definida en [`api-contract.md`](api-contract.md) (fuente única de verdad entre backend y frontend)

## Cambios en la versión 1.1.0

Esta spec describe la versión 1.0.0, que es la respuesta al ejercicio 2. El código actual implementa la **1.1.0** de la spec 03 (§13). Qué cambió respecto de cada sección:

| Sección | En la 1.0.0 (este documento) | En la 1.1.0 |
|---|---|---|
| §2 Alcance | Sin roles ni imágenes | Vista del vendedor ampliada (stock, descuento, imágenes, visibilidad) y catálogo para compradores |
| §4.1–4.2 Estado | `productsSlice` | `sellerProductsSlice` (con los thunks de fila), `catalogSlice` nuevo y `authSlice` con `role`; los filtros del catálogo viven en la URL |
| §5 Pantallas | `/login`, `/register`, `/products` | Más `/` (redirige por rol), `/catalog`, `/catalog/:id` y `/seller/products` (solo vendedor); `/products` redirige a `/`; registro con selector de rol |
| §5.2 Tabla | Nombre, SKU, Categoría, Precio, Stock, Acciones | Además miniatura, precio con descuento, etiquetas de stock, interruptor "Visible / Oculto" y menú "⋯" |
| §6.2 Mensajes | Hasta 409 | Mensajes de 403, 413, 415, imágenes y stock con los textos exactos del contrato §6.2 |
| §9 Configuración | `VITE_API_URL=…/api/v1` | Sin cambios (el prefijo sigue siendo `/api/v1`) |
| §10 Estructura | `features/products` | `features/seller`, `features/catalog`, `components/Pagination` y `PriceTag`, `utils/catalogQuery`, `imageValidation` y `pricing` |
| §11 Criterios | De la 1.0.0 | Se agregan los de la spec 03 §17 |

El detalle de la implementación y de cada decisión está en [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md).

## 1. Objetivo

Construir una interfaz web que consuma la API del ejercicio 1 y permita listar, crear, editar y eliminar productos.

Se evaluará especialmente la organización del frontend, el manejo de estado y la experiencia de usuario.

## 2. Alcance

**Incluye**
- Registro e inicio de sesión (necesarios para obtener el JWT).
- Rutas protegidas: sin sesión solo se ve login y registro.
- Tabla de productos con paginación del lado del servidor, búsqueda y ordenamiento.
- Crear, editar y eliminar productos (con confirmación antes de eliminar).
- Manejo de errores con mensajes amigables en español.
- Estado global con Redux Toolkit.
- Diseño responsive (móvil, tablet y escritorio).

**No incluye**
- Roles y permisos.
- Imágenes de productos.
- Modo oscuro o internacionalización.

## 3. Stack y decisiones técnicas

| Tema | Elección | Por qué |
|---|---|---|
| Framework | React + TypeScript | Mayor experiencia del autor. Tipado alineado con los DTOs del backend. |
| Build | Vite | Arranque rápido. Puerto 5173 (coincide con `CORS_ORIGIN` del backend). |
| Estado global | Redux Toolkit (`createSlice` + `createAsyncThunk`) | Requisito de state management. Estructura clara por slices y Redux DevTools para inspeccionar el estado. |
| Rutas | React Router | Estándar. Permite rutas protegidas. |
| HTTP | Axios | Interceptores para agregar el token y manejar errores en un solo lugar. |
| Estilos | Tailwind CSS v4 (plugin `@tailwindcss/vite`) | Control total del diseño con la paleta propia (sección 14). Responsive con prefijos `sm:`, `md:` y `lg:`. |
| Componentes accesibles | Headless UI | Diálogos y menús accesibles (foco, tecla Escape, `aria-*`) sin imponer estilos, para pintarlos con Tailwind. |
| Formularios | React Hook Form | Validación en el cliente con poco código y buen rendimiento. |
| Tests | Vitest + React Testing Library | Integrados con Vite. |
| Lint | oxlint | Viene en la plantilla actual de Vite (igual que en el backend). Incluye una regla que impide importar `axios` fuera de `src/api/`. |

## 4. Manejo de estado

### 4.1 Qué va en Redux y qué no

| Estado | Dónde | Por qué |
|---|---|---|
| Sesión: `token`, `user` | `authSlice` | Lo usan rutas, header y cliente HTTP. |
| Productos: lista, `meta` de paginación, filtros, `status`, `error` | `productsSlice` | Lo comparten la tabla, el buscador, la paginación y los formularios. |
| Notificaciones (toasts) | `uiSlice` | Cualquier parte de la app puede mostrar un mensaje. |
| Campos de un formulario mientras se edita | Local (React Hook Form) | Solo le importa al formulario. Meterlo en Redux sería sobreingeniería. |
| Diálogo abierto/cerrado | Local (`useState`) en la página | Estado de una sola pantalla. |

### 4.2 Slices

**`authSlice`**
- Estado: `{ token, user, status: 'idle' | 'loading' | 'succeeded' | 'failed', error }`
- Thunks: `login`, `register`, `fetchMe`
- Reducers: `logout`
- El `token` se guarda en `localStorage` para mantener la sesión al recargar.

**`productsSlice`**
- Estado:
  ```ts
  {
    items: Product[],
    meta: { page, limit, total, totalPages },
    filters: { search, sortBy, order },
    status: 'idle' | 'loading' | 'succeeded' | 'failed',
    error: string | null,
    saving: boolean   // para deshabilitar botones mientras se guarda
  }
  ```
- Thunks: `fetchProducts`, `createProduct`, `updateProduct`, `deleteProduct`
- Reducers: `setPage`, `setLimit`, `setSearch`, `setSort`
- Después de crear, editar o eliminar se vuelve a pedir la página actual para que la tabla y el total queden correctos. Si se elimina el último producto de una página, se retrocede a la anterior.

**`uiSlice`**
- Estado: `{ notifications: { id, type: 'success' | 'error' | 'info', message }[] }`
- Reducers: `showNotification`, `hideNotification`

### 4.3 Flujo de datos

```
Componente → dispatch(thunk) → API (axios) → backend
                                   ↓
          reducer actualiza el estado (pending / fulfilled / rejected)
                                   ↓
          useSelector → el componente se vuelve a pintar
```

Los componentes no llaman a axios directamente: siempre pasan por los thunks.

## 5. Pantallas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/login` | Inicio de sesión | Pública. Si ya hay sesión, redirige a `/products`. |
| `/register` | Registro | Pública |
| `/products` | Listado y gestión de productos | Protegida |
| `*` | Página no encontrada | Pública |

### 5.1 Login y registro
- Formularios con validación en el cliente con las mismas reglas del backend (email válido, contraseña de mínimo 8 caracteres con letra y número).
- Botón deshabilitado y con indicador de carga mientras se envía.
- Después del registro, inicia sesión automáticamente o redirige al login con un mensaje de éxito.

### 5.2 Productos
- **Barra superior:** nombre del usuario y botón "Cerrar sesión".
- **Herramientas:** buscador por nombre (espera 400 ms después de dejar de escribir antes de buscar) y botón "Nuevo producto".
- **Tabla (escritorio y tablet):** columnas Nombre, SKU, Categoría, Precio (formato moneda COP), Stock y Acciones (editar, eliminar). Columnas ordenables: nombre, precio, stock.
- **Tarjetas (móvil):** en pantallas pequeñas la tabla se reemplaza por una lista de tarjetas con la misma información y acciones.
- **Paginación:** selector de página y de tamaño (5, 10, 25), con el texto "1–10 de 42".
- **Crear y editar:** diálogo con el formulario. En móvil ocupa la pantalla completa. El mismo componente sirve para crear y editar.
- **Eliminar:** diálogo de confirmación con el nombre del producto.

### 5.3 Estados de la tabla
| Estado | Qué se muestra |
|---|---|
| Cargando por primera vez | Esqueletos (skeletons) de filas |
| Recargando (cambio de página o búsqueda) | La tabla actual con un indicador de carga, sin parpadeo |
| Sin productos | Mensaje "Aún no hay productos" con botón para crear el primero |
| Búsqueda sin resultados | "No se encontraron productos para «texto»" |
| Error al cargar | Mensaje amigable con botón "Reintentar" |

## 6. Manejo de errores

### 6.1 Cliente HTTP (`api/client.ts`)
- Interceptor de petición: agrega `Authorization: Bearer <token>` si hay sesión.
- Interceptor de respuesta: convierte el error del backend (formato de la sección 6 de la spec 01) en un mensaje amigable.
- En **401** con sesión activa: cierra sesión, redirige a `/login` y muestra "Tu sesión expiró, inicia sesión de nuevo".

### 6.2 Mensajes amigables

| Situación | Mensaje |
|---|---|
| Sin conexión o backend apagado | "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo." |
| 400 (validación) | Los mensajes se muestran junto al campo correspondiente cuando es posible; si no, en una notificación. |
| 401 en login | "Correo o contraseña incorrectos." |
| 404 | "El producto ya no existe. Es posible que otra persona lo haya eliminado." (y se recarga la lista) |
| 409 (SKU duplicado) | "Ya existe un producto con ese SKU." (en el campo SKU) |
| 409 (email duplicado) | "Ya existe una cuenta con ese correo." |
| 429 | "Demasiados intentos. Espera un minuto e inténtalo de nuevo." |
| 500 u otro | "Ocurrió un error inesperado. Inténtalo más tarde." |

### 6.3 Confirmaciones de éxito
Notificación breve al crear ("Producto creado"), editar ("Cambios guardados") y eliminar ("Producto eliminado").

### 6.4 Errores de renderizado
Un `ErrorBoundary` en la raíz muestra una pantalla amigable con botón para recargar, en lugar de una pantalla en blanco.

## 7. Diseño responsive

Se usan los breakpoints por defecto de Tailwind, con enfoque *mobile first* (los estilos base son para móvil y se amplían hacia arriba):

| Breakpoint | Ancho | Comportamiento |
|---|---|---|
| Base (móvil) | < 768 px | Tarjetas en vez de tabla, diálogos a pantalla completa, botón "Nuevo" flotante |
| `md:` (tablet) | ≥ 768 px | Tabla con columnas secundarias ocultas (Categoría) |
| `lg:` (escritorio) | ≥ 1024 px | Tabla completa |

- Botones y zonas táctiles de mínimo 44 px de alto.
- Probado en el modo responsive del navegador con al menos 360 px, 768 px y 1280 px de ancho.

## 8. Accesibilidad básica
- Todos los campos con `label`.
- Botones de solo icono (editar, eliminar) con `aria-label`.
- Navegación con teclado en formularios y diálogos.
- Contraste mínimo WCAG AA (4.5:1 en texto normal). Las combinaciones de la sección 14 ya están verificadas.
- Foco visible en todos los elementos interactivos (`focus-visible:ring`).

## 9. Configuración (`.env.example`)

```
VITE_API_URL=http://localhost:3000/api/v1
```

## 10. Estructura de carpetas

Organización por funcionalidad (feature), no por tipo de archivo:

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # rutas
│   ├── app/
│   │   ├── store.ts              # configureStore
│   │   └── hooks.ts              # useAppDispatch, useAppSelector tipados
│   ├── api/
│   │   ├── client.ts             # axios + interceptores
│   │   ├── authApi.ts
│   │   └── productsApi.ts
│   ├── features/
│   │   ├── auth/
│   │   │   ├── authSlice.ts
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── products/
│   │   │   ├── productsSlice.ts
│   │   │   ├── ProductsPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ProductTable.tsx
│   │   │   │   ├── ProductCardList.tsx      # vista móvil
│   │   │   │   ├── ProductFormDialog.tsx
│   │   │   │   ├── DeleteProductDialog.tsx
│   │   │   │   └── ProductsToolbar.tsx
│   │   │   └── productsSlice.test.ts
│   │   └── ui/
│   │       ├── uiSlice.ts
│   │       └── Notifications.tsx
│   ├── components/               # componentes genéricos reutilizables
│   │   ├── ProtectedRoute.tsx
│   │   ├── AppLayout.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── EmptyState.tsx
│   ├── hooks/
│   │   └── useDebounce.ts
│   ├── types/
│   │   ├── product.ts
│   │   └── api.ts                # PaginatedResponse, ApiError
│   └── utils/
│       ├── errorMessages.ts      # mapeo de errores a mensajes amigables
│       └── formatters.ts         # moneda, fechas
├── .env.example
└── README.md
```

## 11. Criterios de aceptación

**Autenticación**
- [ ] Sin sesión, entrar a `/products` redirige a `/login`.
- [ ] Login correcto lleva a `/products`; login incorrecto muestra "Correo o contraseña incorrectos".
- [ ] Al recargar la página la sesión se mantiene.
- [ ] Si el token expira, la siguiente acción redirige al login con un aviso.
- [ ] "Cerrar sesión" limpia el estado y `localStorage`.

**Productos**
- [ ] La tabla muestra los productos del backend con paginación funcional (página y tamaño).
- [ ] La búsqueda filtra desde el backend y vuelve a la página 1.
- [ ] Crear un producto válido lo muestra en la tabla y muestra "Producto creado".
- [ ] El formulario no se envía con datos inválidos y muestra el error en cada campo.
- [ ] Un SKU duplicado muestra el error en el campo SKU.
- [ ] Editar precarga los datos y guarda solo los cambios.
- [ ] Eliminar pide confirmación; al confirmar desaparece de la tabla.
- [ ] Eliminar el último producto de una página regresa a la anterior.
- [ ] Con el backend apagado se muestra el mensaje de conexión y el botón "Reintentar".

**Estado**
- [ ] Redux DevTools muestra las acciones `pending`, `fulfilled` y `rejected` de cada operación.
- [ ] Ningún componente llama a axios directamente.

**Responsive**
- [ ] A 360 px se ven tarjetas y los diálogos ocupan toda la pantalla.
- [ ] A 1280 px se ve la tabla completa.

**Calidad**
- [ ] Tests de `productsSlice` (reducers y estados de los thunks) pasan con `npm test`.
- [ ] `npm run lint` y `npm run build` sin errores.

## 12. Tareas de implementación

1. Crear el proyecto con Vite (React + TypeScript), instalar dependencias y configurar oxlint y `.env`.
2. Configurar Tailwind con el tema de la sección 14, el store (`store.ts`, `hooks.ts`) y React Router.
3. Crear `types/` y el cliente HTTP con interceptores.
4. `authSlice`, `LoginPage`, `RegisterPage` y `ProtectedRoute`.
5. `uiSlice` y el componente de notificaciones.
6. `productsSlice` con los thunks del CRUD y los reducers de paginación y filtros.
7. `ProductsPage` con `ProductTable` y paginación.
8. Búsqueda con debounce y ordenamiento por columnas.
9. `ProductFormDialog` (crear y editar) con React Hook Form y errores del backend por campo.
10. `DeleteProductDialog` y manejo de la página vacía tras eliminar.
11. Vista móvil con `ProductCardList` y ajustes responsive.
12. Estados de carga, vacío y error; `ErrorBoundary`.
13. Tests de `productsSlice`.
14. README del frontend: requisitos, instalación, variables y capturas de pantalla (escritorio y móvil).

## 13. Decisiones abiertas (para revisar)

- **Token en `localStorage`**: simple y suficiente para la prueba. Riesgo: si hubiera una vulnerabilidad XSS, un script podría leerlo. En producción se usaría una cookie `httpOnly` emitida por el backend. Se explicará en el ejercicio 5.
- **`createAsyncThunk` vs RTK Query**: se eligió `createAsyncThunk` porque deja explícitos los estados `pending/fulfilled/rejected` en el slice y es más fácil de explicar. RTK Query ahorraría código de caché, pero oculta más el flujo.
- **Tailwind vs Material UI**: se eligió Tailwind para tener control total del diseño y aplicar una identidad visual propia. A cambio, la tabla, la paginación y las notificaciones se construyen a mano. Headless UI cubre la accesibilidad de los diálogos.
- **Moneda**: precios en pesos colombianos (COP). Cambiar si el backend define otra.

## 14. Tema visual

### 14.1 Origen de la paleta
Los colores se tomaron de la identidad visual de croper.com (plataforma agro), por coherencia con el contexto de la prueba y del ejercicio 3. Se extrajeron midiendo los píxeles de piezas gráficas de la marca. Solo se usan los colores: la app no usa el logo ni el nombre de la marca.

| Token | Hex | Origen | Uso |
|---|---|---|---|
| `brand-500` | `#00C853` | Verde de los titulares | Botones principales, acentos, foco |
| `navy-500` | `#19334C` | Fondo azul de la marca | Barra superior, títulos, texto sobre verde |
| `leaf-500` | `#4A9E12` | Verde de la hoja | Estados de éxito, etiquetas secundarias |
| `ink` | `#273238` | Fondo del logo | Texto principal |

### 14.2 Reglas de contraste (verificadas)

El verde `#00C853` es muy claro: **con texto blanco no cumple contraste** (2.2:1). Por eso:

| Combinación | Contraste | Uso |
|---|---|---|
| Texto `navy-500` sobre `brand-500` | 5.8:1 ✅ | Botón principal |
| Texto blanco sobre `navy-500` | 13.0:1 ✅ | Barra superior |
| Texto `ink` sobre blanco | 13.1:1 ✅ | Texto general |
| Texto `brand-700` sobre blanco | 4.6:1 ✅ | Enlaces y texto verde |
| Texto blanco sobre `leaf-600` | 4.5:1 ✅ | Notificación de éxito |
| Texto blanco sobre `brand-500` | 2.2:1 ❌ | No usar |

### 14.3 Configuración en Tailwind v4 (`src/index.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: "Poppins", ui-sans-serif, system-ui, sans-serif;

  /* Verde principal */
  --color-brand-50:  #ebfbf1;
  --color-brand-100: #d6f6e3;
  --color-brand-200: #adedc8;
  --color-brand-300: #7ae2a6;
  --color-brand-400: #3dd57c;
  --color-brand-500: #00c853;
  --color-brand-600: #00aa47;
  --color-brand-700: #008838;
  --color-brand-800: #00682b;
  --color-brand-900: #004c20;

  /* Azul marino */
  --color-navy-50:  #edeff1;
  --color-navy-100: #dadee2;
  --color-navy-200: #b5bec6;
  --color-navy-300: #8795a2;
  --color-navy-400: #506477;
  --color-navy-500: #19334c;
  --color-navy-600: #152b41;
  --color-navy-700: #112334;
  --color-navy-800: #0d1b28;
  --color-navy-900: #0a131d;

  /* Verde hoja */
  --color-leaf-50:  #f1f7ec;
  --color-leaf-100: #e2efd9;
  --color-leaf-500: #4a9e12;
  --color-leaf-600: #3f860f;
  --color-leaf-700: #326b0c;
  --color-leaf-800: #265209;

  /* Texto */
  --color-ink: #273238;
}
```

La fuente Poppins se carga desde Google Fonts en `index.html`. Es una sans geométrica gratuita, parecida al estilo de los titulares de la marca.

### 14.4 Guía de uso

| Elemento | Clases |
|---|---|
| Fondo de la app | `bg-navy-50` |
| Barra superior | `bg-navy-500 text-white` |
| Tarjetas y tabla | `bg-white border border-navy-100 rounded-xl shadow-sm` |
| Botón principal | `bg-brand-500 text-navy-500 font-semibold hover:bg-brand-400 rounded-lg` |
| Botón secundario | `border border-navy-200 text-navy-500 hover:bg-navy-50 rounded-lg` |
| Botón de eliminar | `bg-red-600 text-white hover:bg-red-700 rounded-lg` |
| Foco | `focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2` |
| Notificación de éxito | `bg-leaf-600 text-white` |
| Notificación de error | `bg-red-600 text-white` |
| Encabezado de tabla | `bg-navy-50 text-navy-500 font-semibold` |
| Errores en formularios | `text-red-600 text-sm` y `border-red-500` en el campo |
