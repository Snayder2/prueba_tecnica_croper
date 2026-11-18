Crea la estructura base de un repositorio para una prueba técnica Full Stack.

## Contexto
- La carpeta raíz se llama `prueba_tecnica_croper`.
- El backend (NestJS + MongoDB) YA ESTÁ IMPLEMENTADO en: <RUTA_ACTUAL_DEL_BACKEND>
- El frontend (React + Vite + TypeScript + Redux Toolkit + Tailwind) aún NO existe; se creará después en otra tarea.
- Ya tengo estos archivos de documentación: `01-backend.md`, `02-frontend.md`, `api-contract.md` y `uso-de-ia.md`.

## Estructura objetivo
```
prueba_tecnica_croper/
├── backend/                 # NestJS (Ejercicio 1) – mover aquí el backend existente
├── frontend/                # React (Ejercicio 2) – solo un README.md provisional
├── docs/
│   ├── specs/
│   │   ├── 01-backend.md
│   │   ├── 02-frontend.md
│   │   └── api-contract.md
│   ├── ia/
│   │   └── uso-de-ia.md
│   └── respuestas-teoricas.md   # fuente de los ejercicios 3, 4 y 5 (luego se exporta a PDF)
├── docker-compose.yml       # opcional: MongoDB para quien no lo tenga instalado
├── .gitignore
└── README.md
```

## Tareas
1. Crea la carpeta `prueba_tecnica_croper` y la estructura anterior.
2. Copia el backend existente dentro de `backend/` SIN modificar su código.
   - No copies `node_modules/`, `dist/` ni `.env`.
   - Si el backend tiene su propia carpeta `.git`, NO la copies: el repositorio será uno solo en la raíz.
   - Verifica que exista `backend/.env.example`; si no existe, créalo con las variables que usa el código, sin valores secretos reales.
3. Coloca los archivos .md de documentación en `docs/specs/` y `docs/ia/` según la estructura.
4. En `docs/respuestas-teoricas.md` crea solo los títulos: Ejercicio 3 – Arquitectura de microservicios, Ejercicio 4 – Optimización de rendimiento web, Ejercicio 5 – Seguridad en APIs y Cloud (con subtítulos: OAuth vs JWT, Protección contra fuerza bruta, Seguridad en MongoDB, Despliegue de microservicios en la nube). No escribas las respuestas.
5. En `frontend/README.md` deja una nota: "Pendiente: se implementará según docs/specs/02-frontend.md".
6. `docker-compose.yml` con un único servicio `mongo` (imagen `mongo:7`, puerto 27017, volumen con nombre para persistir datos). Sin usuario ni contraseña, porque es solo para desarrollo local; agrega un comentario indicándolo.
7. `.gitignore` en la raíz que cubra Node (`node_modules/`, `dist/`, `build/`, `coverage/`), variables de entorno (`.env`, `.env.*` pero NO `.env.example`), logs, archivos de sistema (`.DS_Store`, `Thumbs.db`) y carpetas de editores (`.vscode/` excepto `extensions.json`, `.idea/`).
8. `README.md` en la raíz, en español, con estas secciones:
   - Título y descripción breve de la prueba.
   - Estructura del repositorio.
   - Requisitos: Node.js LTS, npm, MongoDB (local o con Docker).
   - Cómo levantar MongoDB: opción A instalación local, opción B `docker compose up -d`.
   - Cómo ejecutar el backend: instalar, copiar `.env.example` a `.env`, `npm run start:dev`, URL de Swagger `http://localhost:3000/api/docs`.
   - Cómo ejecutar el frontend: marcar como "Pendiente".
   - Documentación: enlaces a `docs/specs/` y a las respuestas teóricas.
   - Uso de IA: enlace a `docs/ia/uso-de-ia.md`.
9. Inicializa git en la raíz y haz un primer commit con el mensaje: `chore: estructura inicial del repositorio`. No hagas push.

## Restricciones
- No modifiques el código del backend.
- No crees el proyecto de frontend todavía.
- No inventes respuestas teóricas.
- Al terminar, muéstrame el árbol de carpetas resultante (sin `node_modules`) y confirma que `git status` está limpio y que ningún `.env` quedó en el commit.