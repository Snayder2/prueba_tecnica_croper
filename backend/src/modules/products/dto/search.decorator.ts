import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** `search` query param shared by the catalog and the seller list (contract §4.6). */
export function SearchField(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      description:
        'Texto a buscar en el nombre, sin distinguir mayúsculas ni tildes. Se busca literal.',
      maxLength: 100,
      example: 'cafe',
    }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    MaxLength(100),
  );
}
