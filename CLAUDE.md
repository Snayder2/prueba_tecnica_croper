# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Full Stack technical test for Croper. It has a NestJS + MongoDB API in `backend/`, a React + Vite + Redux Toolkit + Tailwind v4 + Headless UI app in `frontend/`, and theory answers in `docs/respuestas-teoricas.md`.

On top of the exercises it implements spec 03: a small agro marketplace where **sellers** manage their products (stock, discounts, images) and **buyers** browse a catalog. Development is **spec-driven**. Docs and commit messages are written in Spanish; code, names and API messages are in English, and UI texts are in Spanish exactly as the specs write them.

**Source of truth:** `docs/specs/api-contract.md` (contract **1.1.0**, prefix `/api/v1`) > spec 03 > specs 01/02 > code. If they disagree, change the contract and the spec minimally and record why.

- `docs/specs/03-mejoras-roles-vendedor-comprador.md`: what the code implements now.
- `docs/specs/01-backend.md` and `02-frontend.md`: version 1.0, with a table of what changed in 1.1.0 at the top.
- `docs/specs/IMPLEMENTATION_LOG.md`: decisions D1–D18, one entry per task, and the final verification. Read the decisions before changing behavior.
- `docs/specs/verificacion-1.1.0.md`: a real API walkthrough (curl + responses).
- `docs/ia/uso-de-ia.md`: deliverable log of how AI was used. Sections marked **[COMPLETAR]** are for the user to fill in; don't invent content for them.
- `instructivo.md`: how the user asks for work, with rules and allowed dependencies.

Out of scope: refresh tokens, cloud storage or deployment, carts/orders, admin role, a user with both roles.

## Commands

MongoDB is needed for the backend, its e2e tests and the seed. Use a local Community Server (no auth; `mongosh` is not installed on this machine) or `docker compose up -d` from the repo root.

**Backend** (run from `backend/`; copy `.env.example` → `.env`):
- `npm run start:dev`, `npm run build`, `npm run lint` (oxlint, type-aware)
- `npm test` runs the Vitest unit tests. For a single file: `npm test -- products.service`
- `npm run test:e2e` runs the acceptance criteria against MongoDB. It uses database `productos_db_e2e` and folder `uploads-e2e`, and wipes both. Run it for any backend change: stock concurrency, the conditional image `$push` and real uploads are only tested there.
- `npm run seed` (`nest build && node dist/scripts/seed.js`) resets `users`, `products` and `uploads/products`, then creates 2 sellers, 1 buyer and 30 products with images. The password is `Clave1234`; the emails are in the backend README.
- `npm run docs:export` writes `docs/openapi.json`; keep it in sync with the API. `info.version` must match the contract.

**Frontend** (run from `frontend/`; copy `.env.example` → `.env`):
- `npm run dev` serves on port 5173, a fixed port because it's the origin the backend's CORS allows.
- `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint)
- `npm test` runs Vitest. For a single file: `npm test -- CatalogPage`

On this machine the backend runs on `PORT=3001`, so the local `.env` files use 3001 (`VITE_API_URL`, `PUBLIC_BASE_URL`). The `.env.example` files keep 3000, as in the contract.

Keep Vitest ≥4 and Vite ≥8: `npm audit fix --force` downgrades them and breaks DI and validation in tests.

## Backend architecture

The project uses NestJS 12. It is ESM-only, so relative imports end in `.js`. Tests use Vitest (`vi.fn()`). Modules live in `src/modules/`: `auth`, `users`, `products`, `images`, `storage`.

- **Env:** `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `PUBLIC_BASE_URL` and `UPLOADS_DIR` are all required, and the app refuses to start without them.
- **HTTP setup:** `src/app.setup.ts` holds the HTTP setup shared by `main.ts` and the e2e tests:
  - prefix, helmet, CORS, the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) and the exception filter;
  - the public static `/uploads` route, with `Cross-Origin-Resource-Policy: cross-origin`, immutable cache and nosniff.
  - It takes a `NestExpressApplication`.
- **Error shape:** a single format, `{statusCode, error, message[], path, timestamp}`. Don't change the filter's format.
- **Roles:** `role` (`seller` | `buyer`) is on the user and in the JWT. `JwtStrategy` reloads the user from the DB.
  - `@Roles()` + `RolesGuard` (in `common/`) throw `ForbiddenException()`, which gives the message `"Forbidden"`.
  - `SellerProductsController` (`/seller/products`) is `@Roles('seller')`. `CatalogController` (`/products`) accepts any logged-in user and only returns active products. `/products/categories` must stay declared before `:id`.
- **Ownership:** every seller query filters by `{ _id, sellerId }` in the same query, so another seller's product is a 404. `sellerId` only comes from the token.
- **Responses:** they go through `toProductView`, which turns `sellerId` into `seller: {_id, name}` (never the email) and drops `images[].key`.
- **Stock:** only set on create, then changed through `stock-adjustments` with an atomic `findOneAndUpdate` (`stock: {$gte: q}`). `UpdateProductDto` omits `stock`.
- **Price:** `finalPrice` is stored and always recomputed in the same write.
  - `pricing.ts` has `calculateFinalPrice` (JS) and `finalPriceExpression` (aggregation), the same integer-cents, half-up formula (D1). Don't use `$round`.
  - PATCH and the discount endpoints are update pipelines: Mongoose 9 needs `updatePipeline: true`, and values go in `$literal`. Build a fresh pipeline array each call, because Mongoose appends the `updatedAt` stage to it.
- **Images:**
  - `images/multer.config.ts` (memory storage; limits 1 MB, 1 file, 0 fields; fileFilter → 415) + `ImageFilePipe` (required file, magic numbers via `file-type`) + `ImageProcessingService` (sharp: WebP 1200 px + 400 px thumb, `limitInputPixels`, no metadata).
  - Max 5 per product via a conditional `$push` (`'images.4': {$exists: false}`).
  - Files are behind `StorageService` (`LocalDiskStorage`). Delete in the DB first, then the files; a file error is only logged.
- **Throttling:**
  - Global 100/min per IP, plus 5/min on login.
  - Uploads: 20/min per user via `UserThrottlerGuard` on the route, because the global guard runs before auth.
  - Throttler counters are per route.
- **Mongoose:** `@Prop`s declare `type` explicitly.
- **Swagger is graded:** every endpoint needs `@ApiOperation`, documented params and bodies, and every response code with examples (`ApiErrorResponse`). Tags are `Auth`, `Catalog` and `Seller products`. Keep `class-validator` rules and `@ApiProperty` aligned.

## Frontend architecture

- **HTTP:** only `src/api/` may import axios (an oxlint rule enforces it). It has `productsApi` (`/seller/products`) and `catalogApi` (`/products`).
  - `api/client.ts` attaches the token. On a 401 it runs a session-expired callback that `app/store.ts` passes in, so the client never imports the store.
  - `utils/errorMessages.ts` maps errors to the exact Spanish texts of contract §6.2, and tells the 409s apart by route.
- **State:** the store has `auth` (with `role`, `selectRole`, `selectHomePath`, `HOME_PATHS`), `sellerProducts`, `catalog` and `ui`. Only the state listed in the specs goes in Redux.
  - Row actions (edit, stock, discount, visibility, images) replace the product with the response and never reload the list. Create and delete reload the page.
  - The store's `serializableCheck` ignores `meta.arg.onProgress` and `meta.arg.file` (upload thunk).
- **Catalog filters:** they live in the URL. `useCatalogQuery` → `parseCatalogQuery` → `fetchCatalog`; components write the URL, not Redux.
- **Routes:** in `app/routes.tsx`, with the lazy pages in `app/lazyPages.tsx`. `ProtectedRoute roles={[...]}` sends a wrong role to its home path with a notice. `/` redirects by role.
- **Forms:** forms use React Hook Form. Use `useWatch`/`getValues`, not `watch` (oxlint flags it for React Compiler).
- **Styling:** theme classes come from `src/components/styles.ts`. Don't override a button's display, padding or colors via `className`: Tailwind doesn't resolve conflicting classes by order.
- **Tests:** `src/test/setup.ts` adds `cleanup()` and a `ResizeObserver` stub (Headless UI needs it in jsdom). For file inputs use `userEvent.setup({ applyAccept: false })`.
