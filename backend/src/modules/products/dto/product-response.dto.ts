import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductImageResponseDto {
  @ApiProperty({ description: 'ObjectId de la imagen', example: '673a01c9c4e5b8a9d0f12401' })
  _id: string;

  @ApiProperty({
    description:
      'URL absoluta de la imagen grande (WebP, máximo 1200 px de lado). Pública, sin token',
    example:
      'http://localhost:3000/api/v1/products/6739f3b2c4e5b8a9d0f12346/images/673a01c9c4e5b8a9d0f12401',
  })
  url: string;

  @ApiProperty({
    description: 'URL absoluta de la miniatura (WebP, 400 × 400 px). Pública, sin token',
    example:
      'http://localhost:3000/api/v1/products/6739f3b2c4e5b8a9d0f12346/images/673a01c9c4e5b8a9d0f12401/thumb',
  })
  thumbUrl: string;

  @ApiProperty({ description: 'Ancho de la imagen grande en px', example: 1200 })
  width: number;

  @ApiProperty({ description: 'Alto de la imagen grande en px', example: 1200 })
  height: number;
}

/** Public seller data. The seller's email is never exposed. */
export class SellerSummaryDto {
  @ApiProperty({ description: 'ObjectId del vendedor', example: '6739f2a1c4e5b8a9d0f12345' })
  _id: string;

  @ApiProperty({ example: 'Ana Pérez' })
  name: string;
}

export class ProductResponseDto {
  @ApiProperty({ description: 'ObjectId del producto', example: '6739f3b2c4e5b8a9d0f12346' })
  _id: string;

  @ApiProperty({ example: 'Café de origen Huila 500 g' })
  name: string;

  @ApiPropertyOptional({ example: 'Café especial tostado medio' })
  description?: string;

  @ApiProperty({ description: 'Precio de lista', example: 32000 })
  price: number;

  @ApiProperty({
    description: 'Porcentaje de descuento (0 = sin descuento)',
    type: 'integer',
    minimum: 0,
    maximum: 90,
    example: 10,
  })
  discountPercent: number;

  @ApiProperty({
    description: 'Precio con descuento, calculado por el backend',
    example: 28800,
  })
  finalPrice: number;

  @ApiProperty({ type: 'integer', example: 120 })
  stock: number;

  @ApiPropertyOptional({ example: 'Café' })
  category?: string;

  @ApiProperty({ example: 'CAF-HUI-500' })
  sku: string;

  @ApiProperty({ description: '`false` = oculto en el catálogo', example: true })
  isActive: boolean;

  @ApiProperty({
    type: [ProductImageResponseDto],
    description: 'Hasta 4 imágenes. `images[0]` es la principal; puede estar vacío',
  })
  images: ProductImageResponseDto[];

  @ApiProperty({ type: SellerSummaryDto })
  seller: SellerSummaryDto;

  @ApiProperty({ format: 'date-time', example: '2026-11-17T21:35:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-11-18T14:10:00.000Z' })
  updatedAt: string;
}
