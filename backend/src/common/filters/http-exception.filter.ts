import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { isDuplicateKeyError } from '../utils/mongo-errors.util.js';

interface ResolvedError {
  statusCode: number;
  message: string | string[];
}

/**
 * Turns every exception into the single error shape of spec §6:
 * { statusCode, error, message, path, timestamp }.
 * Unknown errors become a generic 500 and their details are only logged.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      path: request.originalUrl.split('?')[0],
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
        return { statusCode, message: 'Too many requests' };
      }
      if (statusCode >= 500) {
        return { statusCode, message: 'Internal server error' };
      }

      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;
      return { statusCode, message };
    }

    // Fallback: services translate duplicates into specific 409 messages.
    if (isDuplicateKeyError(exception)) {
      return { statusCode: HttpStatus.CONFLICT, message: 'Resource already exists' };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
