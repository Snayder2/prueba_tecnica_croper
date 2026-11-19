import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export const STOCK_ADJUSTMENT_TYPES = ['increase', 'decrease'] as const;
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];

export const MAX_STOCK_ADJUSTMENT = 100_000;

/** Body of POST /seller/products/:id/stock-adjustments (contract §4.3). */
export class StockAdjustmentDto {
  @ApiProperty({
    description: '`increase` = entrada de stock; `decrease` = salida',
    enum: STOCK_ADJUSTMENT_TYPES,
    example: 'decrease',
  })
  @IsIn(STOCK_ADJUSTMENT_TYPES)
  type: StockAdjustmentType;

  @ApiProperty({
    description: 'Unidades a sumar o restar',
    type: 'integer',
    minimum: 1,
    maximum: MAX_STOCK_ADJUSTMENT,
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_STOCK_ADJUSTMENT)
  quantity: number;
}
