import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { SearchField } from './search.decorator.js';

export const SELLER_SORT_FIELDS = ['name', 'price', 'finalPrice', 'stock', 'createdAt'] as const;
export type SellerProductSortField = (typeof SELLER_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Query of GET /seller/products (contract §4.7): page 1, limit 10 (max 100). */
export class SellerProductsQueryDto extends PaginationQueryDto {
  @SearchField()
  search?: string;

  @ApiPropertyOptional({
    description: 'Campo de ordenamiento',
    enum: SELLER_SORT_FIELDS,
    default: 'createdAt',
    example: 'price',
  })
  @IsOptional()
  @IsIn(SELLER_SORT_FIELDS)
  sortBy: SellerProductSortField = 'createdAt';

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
