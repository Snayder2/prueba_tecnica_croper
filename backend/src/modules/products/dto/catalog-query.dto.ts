import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsNotGreaterThan } from '../../../common/decorators/is-not-greater-than.decorator.js';
import { SearchField } from './search.decorator.js';

// Query booleans arrive as text. Implicit conversion would turn "false" into
// true, so onSale and inStock only accept the exact text "true" (spec 03 §6.2).
import { SORT_ORDERS, type SortOrder } from './seller-products-query.dto.js';

export const CATALOG_SORT_FIELDS = ['createdAt', 'finalPrice', 'name', 'discountPercent'] as const;
export type CatalogSortField = (typeof CATALOG_SORT_FIELDS)[number];

/** Query of GET /products (contract §4.6): page 1, limit 12 (max 48). */
export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página (empieza en 1)',
    type: 'integer',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Elementos por página (12, 24 y 48 encajan en la grilla)',
    type: 'integer',
    minimum: 1,
    maximum: 48,
    default: 12,
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit: number = 12;

  @SearchField()
  search?: string;

  @ApiPropertyOptional({
    description: 'Categoría exacta (distingue mayúsculas y tildes)',
    maxLength: 50,
    example: 'Café',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    description: 'Precio final mínimo (`finalPrice` ≥ minPrice)',
    minimum: 0,
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @IsNotGreaterThan('maxPrice')
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Precio final máximo (`finalPrice` ≤ maxPrice)',
    minimum: 0,
    example: 40000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: '`true` = solo productos con descuento. Cualquier otro valor cuenta como `false`',
    type: 'boolean',
    default: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  onSale: boolean = false;

  @ApiPropertyOptional({
    description: '`true` = solo productos con stock. Cualquier otro valor cuenta como `false`',
    type: 'boolean',
    default: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  inStock: boolean = false;

  @ApiPropertyOptional({
    description: 'Campo de ordenamiento',
    enum: CATALOG_SORT_FIELDS,
    default: 'createdAt',
    example: 'finalPrice',
  })
  @IsOptional()
  @IsIn(CATALOG_SORT_FIELDS)
  sortBy: CatalogSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Dirección del ordenamiento',
    enum: SORT_ORDERS,
    default: 'desc',
    example: 'asc',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = 'desc';
}
