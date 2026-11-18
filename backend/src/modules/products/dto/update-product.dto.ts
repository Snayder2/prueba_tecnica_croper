import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';

/** All fields optional; the ones sent follow the same rules as on create. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
