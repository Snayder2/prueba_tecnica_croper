# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Full Stack technical test for Croper. Development is **spec-driven**: each exercise has a spec in `docs/specs/` that is the source of truth for design decisions, and code is implemented one spec task at a time. Docs are written in Spanish.

- `docs/specs/01-backend.md` — Exercise 1: Products REST API (NestJS + MongoDB). Read it before touching backend code.
- `docs/ia/uso-de-ia.md` — deliverable log of how AI was used (prompts, validation, corrections). Sections marked **[COMPLETAR]** are for the user to fill in with what actually happened; don't invent content for them.

Current state: the backend implements all tasks of `docs/specs/01-backend.md` §12 (business modules live in `backend/src/modules/`), and the frontend implements all tasks of `docs/specs/02-frontend.md` §12. Frontend rules: components never import axios (only `src/api/` may; an oxlint rule enforces it), only the state listed in spec §4.1 goes in Redux, forms use React Hook Form, and theme classes come from `src/components/styles.ts` (don't override a button's display/padding/colors via `className`, since Tailwind doesn't resolve conflicts by order). On this machine the backend runs on `PORT=3001`, so the local `frontend/.env` points `VITE_API_URL` there; the `.env.example` files keep 3000 as in the contract. `backend/src/app.setup.ts` holds the HTTP setup shared by `main.ts` and the e2e tests. `npm run test:e2e` checks the §11 criteria against a local MongoDB (database `productos_db_e2e`). Mongoose `@Prop`s declare `type` explicitly, so schemas don't depend on decorator metadata (older Vitest/esbuild setups don't emit it). Keep Vitest ≥4 and Vite ≥8: `npm audit fix --force` downgrades them and breaks DI and validation in tests.

## How to work on spec tasks

Section 12 of the backend spec lists numbered implementation tasks. The user asks for them one at a time, e.g. "Implement task N of `docs/specs/01-backend.md`". When doing so:
- Implement only that task; don't get ahead of later tasks.
- Follow the folder layout in spec §10, the error format in §6, and the security rules in §7.
- Check the work against the acceptance criteria in §11.
- Out of scope (don't add): roles/permissions, refresh tokens, image upload, cloud deployment.
- Open decisions in §13 (hard vs soft delete, open registration, protected GETs) are the user's call; the spec currently picks hard delete, open registration and all product endpoints protected.

## Backend commands

Run from `backend/`. The project is NestJS 12: ESM-only (relative imports end in `.js`), tests on Vitest (`vi.fn()`, not `jest.fn()`), and lint with oxlint. Spec-required scripts: `npm test` (Vitest unit tests for `ProductsService` and `AuthService`), `npm run lint`, and `npm run docs:export` (writes `docs/openapi.json`, which must be kept in sync with the API). Standard NestJS scripts are expected for the rest (`npm run start:dev`, `npm run build`); confirm them in `package.json`. To run a single test file: `npm test -- products.service`.

Requires a local MongoDB (Community Server, no auth) at the `MONGO_URI` in `.env`. Copy `.env.example` → `.env`. The required variables are `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN` and `CORS_ORIGIN`, and the app must refuse to start if `JWT_SECRET` or `MONGO_URI` is missing.

Swagger UI: `http://localhost:3000/api/docs` (JSON at `/api/docs-json`). API prefix: `/api/v1`.

## Backend architecture (per spec)

- `main.ts` wires the cross-cutting pieces: the global `/api/v1` prefix, a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`; this is also what blocks Mongo operator injection), `helmet`, CORS restricted to `CORS_ORIGIN`, and Swagger with Bearer auth plus `persistAuthorization`.
- `common/` holds shared pieces: a global exception filter that produces the single error shape `{statusCode, error, message[], path, timestamp}` and maps Mongo duplicate-key errors to 409 (500s never leak stack or DB details), `ParseObjectIdPipe` (invalid id → 400), and the pagination query DTO.
- `auth/` depends on `users/`: bcrypt hashing (≥10 rounds), JWT via passport-jwt, `JwtAuthGuard`, and a `@CurrentUser` decorator. Login errors are generic 401s. `password` must never appear in responses, logs or Swagger response schemas.
- `products/` is fully guarded by `JwtAuthGuard`. `GET /products` supports `page`/`limit`/`search` (case-insensitive on `name`)/`sortBy`/`order` and returns `{data, meta: {page, limit, total, totalPages}}`. `sku` is unique, so duplicates return 409.
- Throttling: a global limit (~100/min) and a stricter one on `/auth/login` (~5/min → 429).
- Layering rule: controllers only receive requests and respond, business logic lives in services, and data access goes through Mongoose models injected into services.
- Swagger is a graded deliverable. Every endpoint needs `@ApiOperation`, documented params and bodies with examples, and every possible response code with a schema. Keep `class-validator` rules and `@ApiProperty` constraints aligned, and build `UpdateProductDto` with `PartialType` from `@nestjs/swagger`.
