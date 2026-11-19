---
title: "Respuestas teóricas"
subtitle: "Ejercicios 3, 4 y 5"
---

# Ejercicio 3 – Arquitectura de microservicios para un e-commerce agropecuario

## Contexto

El sector agro tiene particularidades que guían el diseño: usuarios rurales con conectividad limitada, demanda estacional (siembra y cosecha), varios actores (productores, proveedores, compradores, transportadores), necesidad de trazabilidad del producto y logística rural con terceros.

No empezaría con microservicios. Arrancaría con un **monolito modular** con límites claros entre módulos y extraería servicios cuando haya una razón concreta (escala, equipos o aislamiento). Los primeros candidatos serían búsqueda, pagos y notificaciones.

## Servicios

| Servicio | Responsabilidad | Datos |
|---|---|---|
| Usuarios | Perfiles, roles, verificación | PostgreSQL |
| Catálogo | Productos, categorías, unidades (kg, bulto, litro) | MongoDB |
| Búsqueda | Texto y filtros por región, categoría, precio | OpenSearch |
| Precios | Precios por región, temporada y volumen | PostgreSQL + Redis |
| Inventario | Stock y reservas | PostgreSQL |
| Pedidos | Carrito y coordinación de la compra | PostgreSQL |
| Pagos | Integración con pasarelas, conciliación | PostgreSQL |
| Logística | Envíos y transportadoras | PostgreSQL |
| Trazabilidad | Historial del lote: origen, insumos, certificaciones | MongoDB (solo inserción) |
| Notificaciones | SMS, WhatsApp, push | Colas |

La autenticación la delego a un proveedor de identidad (Keycloak, Auth0 o Cognito).

## Comunicación

- **Síncrona (REST):** consultas donde el usuario espera respuesta, como catálogo, precios o estado del pedido. Todo entra por un **API Gateway**, con timeouts y circuit breakers.
- **Asíncrona (eventos con RabbitMQ):** procesos entre varios servicios. La compra es una **saga**: `PedidoCreado → StockReservado → PagoAprobado → EnvioDespachado`. Si un paso falla, hay compensación (por ejemplo, se libera el stock si el pago se rechaza).
- **Patrón outbox** para no perder eventos y **consumidores idempotentes** porque un evento puede llegar dos veces.

Elijo RabbitMQ sobre Kafka por su menor complejidad operativa. Kafka tendría sentido si se necesita reprocesar todo el historial de eventos o un volumen muy alto.

## Seguridad

- OAuth 2.0 / OIDC con tokens JWT de vida corta, validados en el gateway.
- Roles por tipo de actor y validación de propiedad: un productor solo edita sus productos.
- Servicios en red privada, con mTLS entre ellos.
- Secretos en un gestor de secretos. Cifrado en tránsito y en reposo.
- Tokenización de tarjetas en la pasarela, sin almacenar datos de pago.
- Cumplimiento de la Ley 1581 de 2012 de protección de datos personales.

## Trade-offs

| Decisión | Ventaja | Costo |
|---|---|---|
| Monolito modular primero | Rapidez y operación simple | Exige disciplina en los límites |
| Base de datos por servicio | Independencia y escalado | Consistencia eventual, sin joins |
| Eventos para la compra | Desacople y resiliencia | Más difícil de depurar |
| Proveedor de identidad externo | Seguridad probada, MFA, SSO | Costo y dependencia |

# Ejercicio 4 – Optimización de rendimiento y UX en móviles

En móviles el rendimiento depende sobre todo de tres factores: **la red** (3G/4G lenta o intermitente), **la CPU** (un celular de gama media tarda varias veces más que un computador en ejecutar JavaScript) y **la cantidad de datos** que se descargan. Las técnicas que propongo atacan esos tres puntos.

Antes de optimizar hay que medir. Uso las **Core Web Vitals** de Google:

| Métrica | Qué mide | Meta |
|---|---|---|
| **LCP** (Largest Contentful Paint) | Cuánto tarda en verse el contenido principal | < 2,5 s |
| **INP** (Interaction to Next Paint) | Cuánto tarda la página en responder a un toque o clic | < 200 ms |
| **CLS** (Cumulative Layout Shift) | Cuánto se mueven los elementos mientras carga | < 0,1 |

Las mido con Lighthouse en modo móvil (simula red lenta y CPU limitada) y, en producción, con la librería `web-vitals` para conocer la experiencia de usuarios reales.

## Técnica 1 – División de código y carga diferida (code splitting y lazy loading)

**Problema.** Por defecto, una aplicación React se empaqueta en un solo archivo JavaScript con todas las pantallas. El usuario que solo quiere iniciar sesión descarga también la tabla, los formularios y los diálogos. En un celular, ese JavaScript no solo hay que descargarlo: también hay que interpretarlo y ejecutarlo, y mientras tanto la pantalla no responde.

**Cómo se mejora.**

- Dividir el código **por rutas**, para que cada pantalla se descargue solo cuando el usuario entra a ella:

```tsx
const ProductsPage = lazy(() => import('./features/products/ProductsPage'));

<Suspense fallback={<PageSkeleton />}>
  <Route path="/products" element={<ProductsPage />} />
</Suspense>
```

- Cargar bajo demanda los componentes pesados que no se ven al inicio (diálogos, gráficas, mapas).
- Revisar qué ocupa espacio en el bundle con una herramienta como `rollup-plugin-visualizer` y reemplazar librerías grandes por alternativas ligeras o importaciones puntuales.
- Definir un presupuesto, por ejemplo menos de 170 KB de JavaScript inicial comprimido, y revisarlo en cada despliegue.

**Resultado.** La primera pantalla carga menos código, aparece antes (mejora **LCP**) y responde más rápido a los toques porque el procesador queda libre (mejora **INP**).

## Técnica 2 – Optimización de imágenes

**Problema.** En un e-commerce las imágenes de productos suelen ser lo que más pesa en la página y casi siempre son el elemento principal que mide el LCP. Es común enviar al celular una foto de 2000 px de ancho y varios cientos de KB para mostrarla en una tarjeta de 300 px. Además, si la imagen no tiene un tamaño reservado, al cargar empuja el contenido hacia abajo y el usuario toca un botón equivocado.

**Cómo se mejora.**

- Usar formatos modernos (**WebP o AVIF**), que pesan entre 30 % y 50 % menos que JPEG con la misma calidad.
- Servir cada imagen en el tamaño que necesita la pantalla con `srcset` y `sizes`, generando las versiones desde un CDN de imágenes:

```html
<img
  src="cafe-400.webp"
  srcset="cafe-400.webp 400w, cafe-800.webp 800w"
  sizes="(max-width: 768px) 100vw, 300px"
  width="400" height="300"
  loading="lazy"
  alt="Café de origen Huila 500 g">
```

- `loading="lazy"` en las imágenes que están fuera de la pantalla, para que solo se descarguen cuando el usuario se acerca a ellas. La imagen principal, en cambio, se carga con prioridad (`fetchpriority="high"`).
- Declarar `width` y `height` (o `aspect-ratio`) para que el navegador reserve el espacio antes de que la imagen llegue.

**Resultado.** Menos datos descargados (importante con planes de datos limitados), contenido principal visible antes (mejora **LCP**) y una página que no se mueve mientras carga (mejora **CLS**).

## Técnica 3 – Caché y funcionamiento sin conexión (PWA)

**Problema.** Un usuario en zona rural pierde la señal con frecuencia. Si cada visita descarga todo de nuevo y cada consulta depende de la red, la app es lenta y, sin conexión, muestra una pantalla en blanco.

**Cómo se mejora.**

- **Caché HTTP en el servidor:** archivos estáticos con nombres versionados (`app.3f9a2c.js`) y `Cache-Control: max-age=31536000, immutable`, para que el navegador no los vuelva a pedir. En la API, `ETag` para responder `304 Not Modified` cuando los datos no cambiaron.
- **Service worker** (con `vite-plugin-pwa` o Workbox), convirtiendo la app en una PWA:
  - Guarda la estructura de la app, así que las visitas siguientes cargan casi al instante aunque la red sea lenta.
  - Aplica la estrategia *stale-while-revalidate* al catálogo: muestra de inmediato los datos guardados y los actualiza en segundo plano.
  - Sin conexión, muestra la última información disponible con un aviso ("Sin conexión, datos del 18 de noviembre") en lugar de un error.
  - Guarda las acciones hechas sin señal y las envía cuando vuelve la conexión.
- Complementar con **paginación en el servidor** y **debounce** en la búsqueda, para pedir solo los datos que se van a mostrar.

**Resultado.** Las visitas repetidas son mucho más rápidas, se consumen menos datos y la app sigue siendo útil sin conexión, que es lo que más afecta la experiencia de un usuario rural.

## Complemento de UX

Además de la velocidad real, la **velocidad percibida** importa: esqueletos de carga en lugar de pantallas en blanco, botones que muestran que se está procesando, diseño mobile first con zonas táctiles de al menos 44 px y teclado numérico (`inputmode="decimal"`) en campos de precio.

# Ejercicio 5 – Seguridad en APIs y Cloud

## OAuth vs JWT

No son lo mismo. **OAuth 2.0** es un protocolo de autorización que define cómo una app obtiene permiso para acceder a recursos (flujos como Authorization Code + PKCE o Client Credentials). **JWT** es un formato de token firmado que lleva datos como usuario, roles y expiración. OAuth suele usar JWT como access token.

Para una API propia con un solo frontend basta con JWT emitido por el backend. Si hay varias aplicaciones, SSO o terceros, uso OAuth 2.0 / OIDC con un proveedor de identidad.

Buenas prácticas con JWT: expiración corta con refresh tokens, nada sensible en el payload, algoritmo fijo al verificar y, en el navegador, cookies `httpOnly` en vez de `localStorage`.

## Protección contra fuerza bruta

- Rate limiting por IP y por cuenta en el login.
- Hash lento de contraseñas (bcrypt o Argon2).
- Mensajes de error genéricos.
- Retrasos progresivos o bloqueo temporal, y CAPTCHA tras varios fallos.
- MFA, sobre todo para administradores.
- WAF y alertas ante picos de intentos fallidos.

## Seguridad en MongoDB

- Autenticación activada y usuarios con permisos mínimos (nunca `root` desde la app).
- Sin exposición pública: red privada y lista de IPs permitidas.
- TLS en tránsito y cifrado en reposo.
- Validación estricta de entradas para evitar inyección NoSQL (por ejemplo, `{"$gt": ""}`). Evitar `$where` y escapar el texto en `$regex`.
- Credenciales en variables de entorno o un gestor de secretos.
- Backups con restauraciones probadas.

## Despliegue de microservicios en la nube

- Contenedores con imágenes mínimas, usuario no root y escaneo de vulnerabilidades.
- Orquestación administrada: ECS Fargate o Cloud Run para empezar, Kubernetes si crece la complejidad.
- Solo el gateway es público; servicios y bases de datos en subredes privadas.
- Permisos IAM mínimos por servicio y secretos en un gestor.
- CI/CD con tests y análisis de seguridad, y despliegues graduales (blue-green o canary) con rollback.
- Infraestructura como código (Terraform), autoescalado, varias zonas de disponibilidad y observabilidad (logs, métricas y trazas).
