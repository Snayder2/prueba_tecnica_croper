import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export const API_PREFIX = 'api/v1';

export interface AppSetupOptions {
  corsOrigin: string;
}

/**
 * Cross-cutting HTTP setup shared by main.ts and the e2e tests,
 * so the tests exercise exactly the same pipeline as the real app.
 */
export function configureApp(app: NestExpressApplication, options: AppSetupOptions): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: options.corsOrigin });

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
