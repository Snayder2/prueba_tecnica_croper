import { ApiProperty } from '@nestjs/swagger';

/** Single error shape returned by every endpoint (spec §6, contract §6). */
export class ErrorResponseDto {
  @ApiProperty({ description: 'Código HTTP', example: 400 })
  statusCode: number;

  @ApiProperty({ description: 'Nombre del código HTTP', example: 'Bad Request' })
  error: string;

  @ApiProperty({
    description:
      'Arreglo de mensajes en errores de validación (cada uno empieza con el nombre del campo); texto en los demás errores',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['price must not be less than 0'],
  })
  message: string | string[];

  @ApiProperty({ description: 'Ruta de la petición', example: '/api/v1/products' })
  path: string;

  @ApiProperty({
    description: 'Fecha del error (ISO 8601, UTC)',
    format: 'date-time',
    example: '2026-11-17T21:30:00.000Z',
  })
  timestamp: string;
}
