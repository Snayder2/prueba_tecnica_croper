import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const PRODUCT_SORT_FIELDS = ['name', 'price', 'stock', 'createdAt'] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class QueryProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Texto a buscar en el nombre (sin distinguir mayúsculas ni tildes)',
    maxLength: 100,
    example: 'cafe',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Campo de ordenamiento',
    enum: PRODUCT_SORT_FIELDS,
    default: 'createdAt',
    example: 'price',
  })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy: ProductSortField = 'createdAt';

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
