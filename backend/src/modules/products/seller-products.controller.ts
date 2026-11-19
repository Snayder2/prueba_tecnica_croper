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
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard.js';
import { ImageFilePipe } from '../images/image-file.pipe.js';
import { imageUploadOptions } from '../images/multer.config.js';
import type { PaginatedResponse } from '../../common/interfaces/paginated-response.interface.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { PublicUser } from '../users/users.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { DiscountDto } from './dto/discount.dto.js';
import { ReorderImagesDto } from './dto/reorder-images.dto.js';
import { PaginatedProductsResponseDto } from './dto/paginated-products-response.dto.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import { SellerProductsQueryDto } from './dto/seller-products-query.dto.js';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import type { ProductView } from './product-view.js';
import { ProductsService } from './products.service.js';
import {
  ApiForbiddenRole,
  ApiProductIdParam,
  ApiProductNotFound,
  ApiTooManyRequests,
  ApiUnauthorized,
  INVALID_ID,
  SELLER_PATH,
  SELLER_PATH_ID,
} from './products.swagger.js';

const SKU_CONFLICT = (path: string) =>
  ApiErrorResponse(409, 'Ya existe un producto con ese SKU en este vendedor', path, {
    summary: 'SKU duplicado',
    message: 'SKU already exists',
  });

const INVALID_BODY = [
  {
    summary: 'Datos inválidos',
    message: ['price must not be less than 0', 'sku must match /^[A-Z0-9-]+$/ regular expression'],
  },
  { summary: 'Campo no permitido', message: ['property sellerId should not exist'] },
];

const INVALID_PATCH = [
  ...INVALID_BODY,
  { summary: 'stock no se edita aquí', message: ['property stock should not exist'] },
];

const NOT_OWN = 'El producto no existe o es de otro vendedor';

/**
 * Product management for sellers. Every operation works only on the products of
 * the seller in the token; another seller's product answers 404. Buyers get 403.
 */
@ApiTags('Seller products')
@ApiBearerAuth()
@ApiUnauthorized(SELLER_PATH)
@ApiForbiddenRole(SELLER_PATH)
@ApiTooManyRequests(SELLER_PATH)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('seller')
@Controller('seller/products')
export class SellerProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar mis productos',
    description:
      'Productos del vendedor del token, activos y ocultos, paginados. `search` busca en el nombre ' +
      'sin distinguir mayúsculas ni tildes.',
  })
  @ApiOkResponse({ description: 'Lista paginada de productos', type: PaginatedProductsResponseDto })
  @ApiErrorResponse(
    400,
    'Parámetros de consulta inválidos',
    SELLER_PATH,
    { summary: 'limit fuera de rango', message: ['limit must not be greater than 100'] },
    {
      summary: 'sortBy no permitido',
      message: ['sortBy must be one of the following values: name, price, finalPrice, stock, createdAt'],
    },
  )
  findAll(
    @Query() query: SellerProductsQueryDto,
    @CurrentUser() user: PublicUser,
  ): Promise<PaginatedResponse<ProductView>> {
    return this.productsService.findSellerProducts(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener uno de mis productos' })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto encontrado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'id con formato inválido', `${SELLER_PATH}/abc`, INVALID_ID)
  @ApiProductNotFound(SELLER_PATH_ID, NOT_OWN)
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.findSellerProduct(id, user);
  }

  @Post()
  @ApiOperation({
    summary: 'Crear un producto',
    description:
      'El producto queda asociado al vendedor del token. `isActive` es `true` por defecto, ' +
      '`discountPercent` empieza en 0 y `finalPrice` es igual a `price`. El `sku` es único por vendedor.',
  })
  @ApiCreatedResponse({ description: 'Producto creado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'Datos inválidos o campos no permitidos', SELLER_PATH, ...INVALID_BODY)
  @SKU_CONFLICT(SELLER_PATH)
  create(@Body() dto: CreateProductDto, @CurrentUser() user: PublicUser): Promise<ProductView> {
    return this.productsService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Editar uno de mis productos',
    description:
      'Solo se modifican los campos enviados. `null` borra `description` o `category`. ' +
      '`stock` no se acepta: se cambia con `POST /seller/products/{id}/stock-adjustments`.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto actualizado', type: ProductResponseDto })
  @ApiErrorResponse(400, 'Datos o id inválidos', SELLER_PATH_ID, ...INVALID_PATCH, INVALID_ID)
  @ApiProductNotFound(SELLER_PATH_ID, NOT_OWN)
  @SKU_CONFLICT(SELLER_PATH_ID)
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.update(id, user, dto);
  }

  @Post(':id/stock-adjustments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ajustar el stock (entrada o salida)',
    description:
      'Operación atómica: una salida mayor al stock actual responde 409 y no cambia nada, ' +
      'así que el stock nunca queda negativo aunque lleguen varias salidas a la vez.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto con el stock actualizado', type: ProductResponseDto })
  @ApiErrorResponse(
    400,
    'Datos o id inválidos',
    `${SELLER_PATH_ID}/stock-adjustments`,
    {
      summary: 'Datos inválidos',
      message: [
        'type must be one of the following values: increase, decrease',
        'quantity must not be less than 1',
      ],
    },
    INVALID_ID,
  )
  @ApiProductNotFound(`${SELLER_PATH_ID}/stock-adjustments`, NOT_OWN)
  @ApiErrorResponse(409, 'La salida es mayor al stock actual', `${SELLER_PATH_ID}/stock-adjustments`, {
    summary: 'Stock insuficiente',
    message: 'Insufficient stock',
  })
  adjustStock(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: StockAdjustmentDto,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.adjustStock(id, user, dto);
  }

  @Put(':id/discount')
  @ApiOperation({
    summary: 'Aplicar o cambiar el descuento',
    description:
      '`finalPrice = round(price × (100 − percent) / 100, 2)`, con las mitades hacia arriba. ' +
      'Se recalcula en la misma operación que guarda el descuento.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto con el descuento aplicado', type: ProductResponseDto })
  @ApiErrorResponse(
    400,
    'Porcentaje o id inválidos',
    `${SELLER_PATH_ID}/discount`,
    { summary: 'Porcentaje fuera de rango', message: ['percent must not be greater than 90'] },
    INVALID_ID,
  )
  @ApiProductNotFound(`${SELLER_PATH_ID}/discount`, NOT_OWN)
  setDiscount(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DiscountDto,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.setDiscount(id, user, dto.percent);
  }

  @Delete(':id/discount')
  @ApiOperation({
    summary: 'Quitar el descuento',
    description:
      'Deja `discountPercent: 0` y `finalPrice` igual a `price`. Sin descuento previo responde 200 sin cambios.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto sin descuento', type: ProductResponseDto })
  @ApiErrorResponse(400, 'id con formato inválido', `${SELLER_PATH}/abc/discount`, INVALID_ID)
  @ApiProductNotFound(`${SELLER_PATH_ID}/discount`, NOT_OWN)
  removeDiscount(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.removeDiscount(id, user);
  }

  @Post(':id/images')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Subir una imagen',
    description:
      'Un archivo por petición, en el campo `image` (`multipart/form-data`, sin campos de texto). ' +
      'JPEG, PNG o WebP según su contenido real, máximo 1 MB (1 048 576 bytes) y 40 megapíxeles. ' +
      'Se re-codifica a WebP (máximo 1200 px y miniatura de 400 × 400) sin metadatos y se agrega ' +
      'al final de `images` (se guarda en base64 dentro del producto). Máximo 4 imágenes por producto. Límite: 20 subidas por minuto por usuario.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', format: 'binary', description: 'JPEG, PNG o WebP, máximo 1 MB' },
      },
    },
  })
  @ApiProductIdParam()
  @ApiCreatedResponse({ description: 'Producto con la imagen nueva al final', type: ProductResponseDto })
  @ApiErrorResponse(
    400,
    'Petición mal formada, id inválido o imagen de más de 40 megapíxeles',
    `${SELLER_PATH_ID}/images`,
    { summary: 'Sin archivo', message: 'Image is required' },
    { summary: 'Campo con otro nombre', message: 'Unexpected file field - file' },
    { summary: 'Varios archivos', message: 'Too many files' },
    { summary: 'Campos de texto', message: 'Too many fields' },
    { summary: 'Resolución excesiva', message: 'Image dimensions too large' },
    INVALID_ID,
  )
  @ApiProductNotFound(`${SELLER_PATH_ID}/images`, NOT_OWN)
  @ApiErrorResponse(409, 'El producto ya tiene 4 imágenes', `${SELLER_PATH_ID}/images`, {
    summary: 'Límite de imágenes',
    message: 'Image limit reached',
  })
  @ApiErrorResponse(413, 'El archivo pesa más de 1 MB', `${SELLER_PATH_ID}/images`, {
    summary: 'Archivo muy grande',
    message: 'File too large',
  })
  @ApiErrorResponse(415, 'No es JPEG, PNG ni WebP', `${SELLER_PATH_ID}/images`, {
    summary: 'Formato no permitido',
    message: 'Unsupported file type',
  })
  @ApiTooManyRequests(`${SELLER_PATH_ID}/images`, 'Más de 20 subidas por minuto')
  // Guards run before the interceptor: no token, a buyer or the rate limit are
  // rejected before Multer reads a single byte of the file.
  @UseGuards(UserThrottlerGuard)
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  uploadImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile(ImageFilePipe) file: Express.Multer.File,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.addImage(id, user, file);
  }

  @Delete(':id/images/:imageId')
  @ApiOperation({
    summary: 'Eliminar una imagen',
    description: 'Se quita del producto junto con sus datos.',
  })
  @ApiProductIdParam()
  @ApiParam({
    name: 'imageId',
    description: 'ObjectId de la imagen',
    example: '673a01c9c4e5b8a9d0f12401',
  })
  @ApiOkResponse({ description: 'Producto sin esa imagen', type: ProductResponseDto })
  @ApiErrorResponse(400, 'id o imageId con formato inválido', `${SELLER_PATH_ID}/images/abc`, INVALID_ID)
  @ApiErrorResponse(
    404,
    'El producto o la imagen no existen',
    `${SELLER_PATH_ID}/images/673a01c9c4e5b8a9d0f12401`,
    { summary: 'Producto no encontrado', message: 'Product not found' },
    { summary: 'Imagen no encontrada', message: 'Image not found' },
  )
  deleteImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('imageId', ParseObjectIdPipe) imageId: string,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.deleteImage(id, user, imageId);
  }

  @Put(':id/images/order')
  @ApiOperation({
    summary: 'Reordenar las imágenes',
    description:
      '`imageIds` debe contener exactamente los ids actuales, en el nuevo orden. ' +
      'La primera imagen pasa a ser la principal. `[]` solo es válido si el producto no tiene imágenes.',
  })
  @ApiProductIdParam()
  @ApiOkResponse({ description: 'Producto con las imágenes en el nuevo orden', type: ProductResponseDto })
  @ApiErrorResponse(
    400,
    'imageIds inválido o distinto de las imágenes actuales',
    `${SELLER_PATH_ID}/images/order`,
    {
      summary: 'No coincide con las imágenes actuales',
      message: ['imageIds must contain exactly the current image ids'],
    },
    { summary: 'Ids repetidos', message: ["All imageIds's elements must be unique"] },
    INVALID_ID,
  )
  @ApiProductNotFound(`${SELLER_PATH_ID}/images/order`, NOT_OWN)
  reorderImages(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ReorderImagesDto,
    @CurrentUser() user: PublicUser,
  ): Promise<ProductView> {
    return this.productsService.reorderImages(id, user, dto.imageIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar uno de mis productos', description: 'Eliminación física.' })
  @ApiProductIdParam()
  @ApiNoContentResponse({ description: 'Producto eliminado (sin cuerpo)' })
  @ApiErrorResponse(400, 'id con formato inválido', `${SELLER_PATH}/abc`, INVALID_ID)
  @ApiProductNotFound(SELLER_PATH_ID, NOT_OWN)
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: PublicUser,
  ): Promise<void> {
    return this.productsService.remove(id, user);
  }
}
