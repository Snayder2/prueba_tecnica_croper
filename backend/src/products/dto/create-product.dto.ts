import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const SKU_PATTERN = /^[A-Z0-9-]+$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProductDto {
  @ApiProperty({
    description: 'Nombre del producto (sin espacios al inicio ni al final)',
    minLength: 3,
    maxLength: 100,
    example: 'Fertilizante NPK 15-15-15 50 kg',
  })
  @Transform(trim)
  @IsString()
  @Length(3, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del producto',
    maxLength: 500,
    example: 'Fertilizante compuesto para cultivos de ciclo corto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Precio. Mayor o igual a 0, con máximo 2 decimales',
    minimum: 0,
    example: 145000,
  })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Unidades disponibles (entero mayor o igual a 0)',
    type: 'integer',
    minimum: 0,
    example: 40,
  })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({
    description: 'Categoría del producto',
    maxLength: 50,
    example: 'Fertilizantes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({
    description: 'Código único: letras mayúsculas, números y guiones',
    minLength: 3,
    maxLength: 30,
    pattern: SKU_PATTERN.source,
    example: 'FER-NPK-50',
  })
  @IsString()
  @Length(3, 30)
  @Matches(SKU_PATTERN)
  sku: string;

  @ApiPropertyOptional({
    description: 'Si el producto está activo',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
