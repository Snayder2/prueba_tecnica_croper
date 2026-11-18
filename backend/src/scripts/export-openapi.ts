/**
 * Writes the OpenAPI spec to <repo>/docs/openapi.json (npm run docs:export).
 * Preview mode builds the module graph without instantiating providers,
 * so no MongoDB connection is needed.
 */
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module.js';
import { API_PREFIX } from '../app.setup.js';
import { createSwaggerDocument } from '../config/swagger.config.js';

const OUTPUT = resolve(import.meta.dirname, '..', '..', '..', 'docs', 'openapi.json');

const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'] });
app.setGlobalPrefix(API_PREFIX);

const document = createSwaggerDocument(app);
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

console.log(`OpenAPI spec written to ${OUTPUT}`);
await app.close();
