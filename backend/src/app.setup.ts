import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { UPLOADS_URL_PATH } from './modules/storage/local-disk.storage.js';

export const API_PREFIX = 'api/v1';

export interface AppSetupOptions {
  corsOrigin: string;
  /** UPLOADS_DIR: served publicly at /uploads, outside the API prefix. */
  uploadsDir: string;
}

/**
 * Cross-cutting HTTP setup shared by main.ts and the e2e tests,
 * so the tests exercise exactly the same pipeline as the real app.
 */
export function configureApp(app: NestExpressApplication, options: AppSetupOptions): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: options.corsOrigin });

  // Product images are public (an <img> cannot send the Authorization header).
  // File names are random and never reused, so they can be cached forever.
  // helmet sends Cross-Origin-Resource-Policy: same-origin, which would block
  // the images on the frontend origin (localhost:5173); here it is relaxed.
  app.useStaticAssets(resolve(options.uploadsDir), {
    prefix: UPLOADS_URL_PATH,
    index: false,
    dotfiles: 'deny',
    setHeaders: (res: Response) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strips and rejects unknown fields; also blocks Mongo operators like {"$gt": ""}.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
