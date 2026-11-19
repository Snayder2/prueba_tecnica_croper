import { ApiParam } from '@nestjs/swagger';
import { API_PREFIX } from '../../app.setup.js';
import {
  ApiErrorResponse,
  type ErrorExample,
} from '../../common/decorators/api-error-response.decorator.js';

/** Swagger pieces shared by CatalogController and SellerProductsController. */

export const SAMPLE_PRODUCT_ID = '6739f3b2c4e5b8a9d0f12346';
export const CATALOG_PATH = `/${API_PREFIX}/products`;
export const SELLER_PATH = `/${API_PREFIX}/seller/products`;
export const SELLER_PATH_ID = `${SELLER_PATH}/${SAMPLE_PRODUCT_ID}`;

export const ApiProductIdParam = () =>
  ApiParam({
    name: 'id',
    description: 'ObjectId del producto (24 caracteres hexadecimales)',
    example: SAMPLE_PRODUCT_ID,
  });

export const INVALID_ID: ErrorExample = { summary: 'id con formato inválido', message: 'Invalid id' };

export const ApiProductNotFound = (path: string, description = 'El producto no existe') =>
  ApiErrorResponse(404, description, path, {
    summary: 'Producto no encontrado',
    message: 'Product not found',
  });

export const ApiUnauthorized = (path: string) =>
  ApiErrorResponse(401, 'Sin token, token inválido o expirado', path, {
    summary: 'No autenticado',
    message: 'Unauthorized',
  });

export const ApiTooManyRequests = (path: string, description = 'Límite de peticiones superado') =>
  ApiErrorResponse(429, description, path, {
    summary: 'Demasiadas peticiones',
    message: 'Too many requests',
  });

export const ApiForbiddenRole = (path: string) =>
  ApiErrorResponse(403, 'El usuario no tiene rol `seller`', path, {
    summary: 'Rol sin permiso',
    message: 'Forbidden',
  });
