import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsMongoId } from 'class-validator';
import { MAX_PRODUCT_IMAGES } from '../schemas/product.schema.js';

/** Body of PUT /seller/products/:id/images/order (contract §4.5). */
export class ReorderImagesDto {
  @ApiProperty({
    description:
      'Ids de las imágenes actuales del producto en el nuevo orden (la primera es la principal). ' +
      'Deben ser exactamente los actuales, sin repetidos ni faltantes.',
    type: [String],
    maxItems: MAX_PRODUCT_IMAGES,
    example: ['673a01c9c4e5b8a9d0f12402', '673a01c9c4e5b8a9d0f12401'],
  })
  @IsArray()
  @ArrayMaxSize(MAX_PRODUCT_IMAGES)
  @ArrayUnique()
  @IsMongoId({ each: true })
  imageIds: string[];
}
