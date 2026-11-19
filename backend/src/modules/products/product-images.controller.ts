import { applyDecorators, Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { ImageVariant } from './image-urls.js';
import { ProductsService } from './products.service.js';
import { ApiProductIdParam, CATALOG_PATH, INVALID_ID, SAMPLE_PRODUCT_ID } from './products.swagger.js';

const SAMPLE_IMAGE_ID = '673a01c9c4e5b8a9d0f12401';
const IMAGE_PATH = `${CATALOG_PATH}/${SAMPLE_PRODUCT_ID}/images/${SAMPLE_IMAGE_ID}`;

/** Swagger and HTTP headers shared by both image versions. */
const ImageEndpoint = (summary: string, size: string, path: string) =>
  applyDecorators(
    // An image id is never reused (a new upload is a new id), so it can be
    // cached forever. helmet sends Cross-Origin-Resource-Policy: same-origin,
    // which would block the <img> on the frontend origin (localhost:5173).
    Header('Cache-Control', 'public, max-age=31536000, immutable'),
    Header('Cross-Origin-Resource-Policy', 'cross-origin'),
    Header('X-Content-Type-Options', 'nosniff'),
    ApiOperation({
      summary,
      description:
        `${size}. Público: no necesita token, porque una etiqueta \`<img>\` no envía el header ` +
        '`Authorization`. Es la URL que devuelven `url` y `thumbUrl` en `Product.images`. ' +
        'Solo sirve imágenes de productos activos: un producto oculto o inexistente, o una imagen ' +
        'que no existe, responden 404. Sin límite de peticiones (como antes la ruta estática): ' +
        'una página del catálogo carga hasta 48 miniaturas y la caché del navegador las conserva.',
    }),
    ApiProductIdParam(),
    ApiParam({ name: 'imageId', description: 'ObjectId de la imagen', example: SAMPLE_IMAGE_ID }),
    ApiOkResponse({
      description:
        'Binario WebP. Headers: `Cache-Control: public, max-age=31536000, immutable`, ' +
        '`X-Content-Type-Options: nosniff` y `Cross-Origin-Resource-Policy: cross-origin`.',
      content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } },
    }),
    ApiErrorResponse(400, 'id o imageId con formato inválido', `${CATALOG_PATH}/abc/images/abc`, INVALID_ID),
    ApiErrorResponse(
      404,
      'El producto no existe o está oculto, o la imagen no existe',
      path,
      { summary: 'Imagen no encontrada', message: 'Image not found' },
    ),
  );

/**
 * Public image endpoint (spec 03 §7.4): reads the base64 stored in the product
 * and answers the binary. It lives apart from CatalogController because that
 * one requires a JWT for every route.
 */
@ApiTags('Catalog')
@SkipThrottle()
@Controller('products')
export class ProductImagesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(':id/images/:imageId')
  @ImageEndpoint('Imagen de un producto', 'Imagen grande (WebP, máximo 1200 px de lado)', IMAGE_PATH)
  getImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('imageId', ParseObjectIdPipe) imageId: string,
  ): Promise<StreamableFile> {
    return this.serve(id, imageId, 'large');
  }

  @Get(':id/images/:imageId/thumb')
  @ImageEndpoint('Miniatura de una imagen', 'Miniatura (WebP, 400 × 400 px)', `${IMAGE_PATH}/thumb`)
  getThumbnail(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('imageId', ParseObjectIdPipe) imageId: string,
  ): Promise<StreamableFile> {
    return this.serve(id, imageId, 'thumb');
  }

  private async serve(id: string, imageId: string, variant: ImageVariant): Promise<StreamableFile> {
    const { mimeType, buffer } = await this.productsService.findImageContent(id, imageId, variant);
    return new StreamableFile(buffer, { type: mimeType, length: buffer.length });
  }
}
