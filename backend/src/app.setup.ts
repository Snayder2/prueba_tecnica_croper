import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

export const API_PREFIX = 'api/v1';

/**
 * Cross-cutting HTTP setup shared by main.ts and the e2e tests,
 * so the tests exercise exactly the same pipeline as the real app.
 */
export function configureApp(app: INestApplication, corsOrigin: string): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.enableCors({ origin: corsOrigin });
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
