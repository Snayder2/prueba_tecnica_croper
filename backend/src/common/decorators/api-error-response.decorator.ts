import { ApiResponse } from '@nestjs/swagger';
import { STATUS_CODES } from 'node:http';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

export interface ErrorExample {
  summary: string;
  message: string | string[];
}

/**
 * Documents an error response with the shared ErrorResponseDto schema and one
 * example body per case, so Swagger shows the exact contract messages.
 */
export function ApiErrorResponse(
  status: number,
  description: string,
  path: string,
  ...examples: ErrorExample[]
): MethodDecorator & ClassDecorator {
  const entries = examples.map((example, index) => [
    `case${index + 1}`,
    {
      summary: example.summary,
      value: {
        statusCode: status,
        error: STATUS_CODES[status],
        message: example.message,
        path,
        timestamp: '2026-11-17T21:30:00.000Z',
      },
    },
  ]);

  return ApiResponse({
    status,
    description,
    type: ErrorResponseDto,
    examples: Object.fromEntries(entries),
  });
}
