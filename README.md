# Prueba Técnica Full Stack – Croper

Prueba técnica Full Stack con tres partes:

- **Ejercicio 1:** una API REST de productos con NestJS y MongoDB.
- **Ejercicio 2:** un frontend en React con Vite, TypeScript, Redux Toolkit y Tailwind.
- **Ejercicios 3, 4 y 5:** respuestas teóricas.

Como mejora adicional ([spec 03](docs/specs/03-mejoras-roles-vendedor-comprador.md), contrato 1.1.0), la app es un pequeño marketplace agro. Los **vendedores** gestionan sus productos con stock, descuentos e imágenes, y los **compradores** recorren un catálogo con filtros.

## Estructura del repositorio

```
prueba_tecnica_croper/
├── backend/                 # NestJS (Ejercicio 1)
├── frontend/                # React (Ejercicio 2)
├── docs/
│   ├── specs/               # Especificaciones y contrato de la API
│   ├── ia/                  # Uso de IA
│   └── respuestas-teoricas.md
├── docker-compose.yml       # MongoDB para desarrollo local
├── .gitignore
└── README.md
```

## Requisitos

- Node.js LTS
- npm
- MongoDB (instalación local o con Docker)

## Cómo levantar MongoDB

**Opción A – Instalación local:** instala MongoDB Community Server y déjalo corriendo en `mongodb://localhost:27017`.

**Opción B – Docker:**

```bash
docker compose up -d
```

## Cómo ejecutar el backend

```bash
cd backend
npm install
cp .env.example .env
npm run seed          # base de datos con usuarios, productos e imágenes de prueba
npm run start:dev
```

Swagger: http://localhost:3000/api/docs

Usuarios de prueba (contraseña `Clave1234`): `ana.vendedora@correo.com` y `bruno.vendedor@correo.com` (vendedores), y `carla.compradora@correo.com` (comprador). `npm run seed` se puede repetir para volver a ese estado.

Detalle de variables, tests y ejemplos en [backend/README.md](backend/README.md).

## Cómo ejecutar el frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: http://localhost:5173 (puerto fijo: es el origen que permite el CORS del backend). Si el backend no usa el puerto 3000, ajusta `VITE_API_URL` en `frontend/.env`.

Detalle, capturas y decisiones en [frontend/README.md](frontend/README.md).

## Documentación

- [Especificación del backend](docs/specs/01-backend.md)
- [Especificación del frontend](docs/specs/02-frontend.md)
- [Spec 03: vendedores, compradores, imágenes, stock y descuentos](docs/specs/03-mejoras-roles-vendedor-comprador.md)
- [Registro de implementación de la spec 03](docs/specs/IMPLEMENTATION_LOG.md)
- [Contrato de la API](docs/specs/api-contract.md)
- [OpenAPI exportado](docs/openapi.json) (se regenera con `npm run docs:export` en `backend/`)
- [Respuestas teóricas (Ejercicios 3, 4 y 5)](docs/respuestas-teoricas.md)

## Uso de IA

Ver [docs/ia/uso-de-ia.md](docs/ia/uso-de-ia.md).
