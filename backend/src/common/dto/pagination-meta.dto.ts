import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../interfaces/paginated-response.interface.js';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ description: 'Página actual', example: 1 })
  page: number;

  @ApiProperty({ description: 'Elementos por página', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total de elementos que cumplen el filtro', example: 42 })
  total: number;

  @ApiProperty({ description: 'Total de páginas', example: 5 })
  totalPages: number;
}
