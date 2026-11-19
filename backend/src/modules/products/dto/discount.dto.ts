import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_DISCOUNT_PERCENT } from '../schemas/product.schema.js';

/** Body of PUT /seller/products/:id/discount (contract §4.4). */
export class DiscountDto {
  @ApiProperty({
    description: 'Porcentaje de descuento (entero)',
    type: 'integer',
    minimum: 1,
    maximum: MAX_DISCOUNT_PERCENT,
    example: 15,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_DISCOUNT_PERCENT)
  percent: number;
}
