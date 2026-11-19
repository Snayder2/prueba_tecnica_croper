import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator.js';
import type { PaginatedResponse } from '../../common/interfaces/paginated-response.interface.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CatalogQueryDto } from './dto/catalog-query.dto.js';
import { PaginatedProductsResponseDto } from './dto/paginated-products-response.dto.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import type { ProductView } from './product-view.js';
import { ProductsService } from './products.service.js';
import {
  ApiProductIdParam,
  ApiProductNotFound,
  ApiTooManyRequests,
  ApiUnauthorized,
  CATALOG_PATH,
  INVALID_ID,
  SAMPLE_PRODUCT_ID,
} from './products.swagger.js';

/** Read-only catalog for any authenticated user: only active products. */
@ApiTags('Catalog')
@ApiBearerAuth()
@ApiUnauthorized(CATALOG_PATH)
@ApiTooManyRequests(CATALOG_PATH)
@UseGuards(JwtAuthGuard)
@Controller('products')
export class CatalogController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Catálogo de productos',
    description:
      'Productos activos de todos los vendedores, paginados. `search` busca en el nombre sin ' +
      'distinguir mayúsculas ni tildes. Si `page` supera `totalPages`, devuelve `data: []` con el `meta` correcto.',
  })
  @ApiOkResponse({ description: 'Lista paginada de productos', type: PaginatedProductsResponseDto })
  @ApiErrorResponse(
    400,
    'Parámetros de consulta inválidos',
    CATALOG_PATH,
    { summary: 'limit fuera de rango', message: ['limit must not be greater than 48'] },
    {
      summary: 'Rango de precio inválido',
      message: ['minPrice must not be greater than maxPrice'],
    },
  )
  findAll(@Query() query: CatalogQueryDto): Promise<PaginatedResponse<ProductView>> {
    return this.productsService.findCatalog(query);
  }

  // Declared before ':id'; otherwise ParseObjectIdPipe would answer 400 to "categories".
  @Get('categories')
  @ApiOperation({
    summary: 'Categorías del catálogo',
    description:
      'Categorías distintas de los productos activos, ordenadas alfabéticamente en español. ' +
      'No incluye productos sin categoría.',
  })
  @ApiOkResponse({
    description: 'Lista de categorías',
    schema: { type: 'array', items: { type: 'string' }, example: ['Café', 'Fertilizantes', 'Semillas'] },
  })
  findCategories(): Promise<string[]> {
    return this.productsService.findCategories();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de un producto del catálogo',
    description: 'Un producto oculto (`isActive: false`) responde 404.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto encontrado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'id con formato inválido', `${CATALOG_PATH}/abc`, INVALID_ID)
  @ApiProductNotFound(`${CATALOG_PATH}/${SAMPLE_PRODUCT_ID}`, 'El producto no existe o está oculto')
  findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<ProductView> {
    return this.productsService.findCatalogProduct(id);
  }
}
