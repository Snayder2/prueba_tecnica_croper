import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator.js';
import type { PaginatedResponse } from '../../common/interfaces/paginated-response.interface.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { PaginatedProductsResponseDto } from './dto/paginated-products-response.dto.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';
import type { ProductRecord } from './schemas/product.schema.js';

const PATH = '/api/v1/products';
const PATH_ID = '/api/v1/products/6739f3b2c4e5b8a9d0f12346';

const ID_PARAM = ApiParam({
  name: 'id',
  description: 'ObjectId del producto (24 caracteres hexadecimales)',
  example: '6739f3b2c4e5b8a9d0f12346',
});
const INVALID_ID = { summary: 'id con formato inválido', message: 'Invalid id' };
const NOT_FOUND = ApiErrorResponse(404, 'El producto no existe', PATH_ID, {
  summary: 'Producto no encontrado',
  message: 'Product not found',
});
const SKU_CONFLICT = (path: string) =>
  ApiErrorResponse(409, 'Ya existe un producto con ese SKU', path, {
    summary: 'SKU duplicado',
    message: 'SKU already exists',
  });
const INVALID_BODY = [
  {
    summary: 'Datos inválidos',
    message: [
      'price must not be less than 0',
      'sku must match /^[A-Z0-9-]+$/ regular expression',
    ],
  },
  { summary: 'Campo no permitido', message: ['property foo should not exist'] },
];

@ApiTags('Products')
@ApiBearerAuth()
@ApiErrorResponse(401, 'Sin token, token inválido o expirado', PATH, {
  summary: 'No autenticado',
  message: 'Unauthorized',
})
@ApiErrorResponse(429, 'Límite global de peticiones superado', PATH, {
  summary: 'Demasiadas peticiones',
  message: 'Too many requests',
})
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un producto',
    description: '`isActive` es `true` por defecto. El `sku` debe ser único.',
  })
  @ApiCreatedResponse({ description: 'Producto creado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'Datos inválidos o campos no permitidos', PATH, ...INVALID_BODY)
  @SKU_CONFLICT(PATH)
  create(@Body() dto: CreateProductDto): Promise<ProductRecord> {
    return this.productsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar productos',
    description:
      'Lista paginada. `search` busca en el nombre sin distinguir mayúsculas ni tildes. ' +
      'Si `page` supera `totalPages`, devuelve `data: []` con el `meta` correcto.',
  })
  @ApiOkResponse({ description: 'Lista paginada de productos', type: PaginatedProductsResponseDto })
  @ApiErrorResponse(
    400,
    'Parámetros de consulta inválidos',
    PATH,
    { summary: 'limit fuera de rango', message: ['limit must not be greater than 100'] },
    {
      summary: 'sortBy no permitido',
      message: ['sortBy must be one of the following values: name, price, stock, createdAt'],
    },
  )
  findAll(@Query() query: QueryProductsDto): Promise<PaginatedResponse<ProductRecord>> {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un producto por id' })
  @ID_PARAM
  @ApiOkResponse({ description: 'Producto encontrado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'id con formato inválido', '/api/v1/products/abc', INVALID_ID)
  @NOT_FOUND
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<ProductRecord> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar parcialmente un producto',
    description:
      'Solo se modifican los campos enviados. `null` borra `description` o `category`.',
  })
  @ID_PARAM
  @ApiOkResponse({ description: 'Producto actualizado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'Datos o id inválidos', PATH_ID, ...INVALID_BODY, INVALID_ID)
  @NOT_FOUND
  @SKU_CONFLICT(PATH_ID)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductRecord> {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un producto', description: 'Eliminación física.' })
  @ID_PARAM
  @ApiNoContentResponse({ description: 'Producto eliminado (sin cuerpo)' })
  @ApiErrorResponse(400, 'id con formato inválido', '/api/v1/products/abc', INVALID_ID)
  @NOT_FOUND
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.productsService.remove(id);
  }
}
