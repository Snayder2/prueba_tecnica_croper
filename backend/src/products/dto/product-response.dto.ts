import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ description: 'ObjectId del producto', example: '6739f3b2c4e5b8a9d0f12346' })
  _id: string;

  @ApiProperty({ example: 'Café de origen Huila 500 g' })
  name: string;

  @ApiPropertyOptional({ example: 'Café especial tostado medio' })
  description?: string;

  @ApiProperty({ example: 32000 })
  price: number;

  @ApiProperty({ type: 'integer', example: 120 })
  stock: number;

  @ApiPropertyOptional({ example: 'Café' })
  category?: string;

  @ApiProperty({ example: 'CAF-HUI-500' })
  sku: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:35:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:35:00.000Z' })
  updatedAt: string;
}
