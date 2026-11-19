import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';

/**
 * All fields optional; the ones sent follow the same rules as on create.
 * `stock` is not accepted (400): it only changes through stock adjustments.
 */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['stock'] as const)) {}
