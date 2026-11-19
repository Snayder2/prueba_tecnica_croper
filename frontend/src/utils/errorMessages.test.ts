import { describe, expect, it } from 'vitest';
import { MESSAGES, toAppError } from './errorMessages';

/** Builds an axios-like error for `url` with an ApiError body. */
function httpError(status: number, url: string, message: string | string[] = 'x') {
  return {
    config: { url },
    response: {
      status,
      data: { statusCode: status, error: 'Error', message, path: url, timestamp: '' },
    },
  };
}

const ID = '6739f3b2c4e5b8a9d0f12346';

describe('toAppError (contract 1.1.0 §6.2)', () => {
  it('tells the 409s apart by route', () => {
    expect(toAppError(httpError(409, '/auth/register')).fieldErrors).toEqual({
      email: MESSAGES.duplicateEmail,
    });
    expect(toAppError(httpError(409, `/seller/products/${ID}/stock-adjustments`)).message).toBe(
      'No hay suficiente stock para esa salida.',
    );
    expect(toAppError(httpError(409, `/seller/products/${ID}/images`)).message).toBe(
      'Este producto ya tiene 4 imágenes.',
    );
    expect(toAppError(httpError(409, `/seller/products/${ID}`)).fieldErrors).toEqual({
      sku: 'Ya existe un producto con ese SKU.',
    });
  });

  it('maps 403, 413 and 415 to the texts of the contract', () => {
    expect(toAppError(httpError(403, '/seller/products')).message).toBe('No tienes acceso a esa sección.');
    expect(toAppError(httpError(413, `/seller/products/${ID}/images`)).message).toBe(
      'La imagen pesa más de 1 MB.',
    );
    expect(toAppError(httpError(415, `/seller/products/${ID}/images`)).message).toBe(
      'Formato no permitido. Usa JPG, PNG o WebP.',
    );
  });

  it('maps the 400s of images: malformed upload, too many pixels, changed order', () => {
    const upload = `/seller/products/${ID}/images`;
    expect(toAppError(httpError(400, upload, 'Image is required')).message).toBe('No se pudo subir la imagen.');
    expect(toAppError(httpError(400, upload, 'Image dimensions too large')).message).toBe(
      'La imagen tiene demasiados píxeles. El máximo es 40 megapíxeles.',
    );
    expect(
      toAppError(httpError(400, `${upload}/order`, ['imageIds must contain exactly the current image ids'])).message,
    ).toBe('Las imágenes cambiaron. Vuelve a intentarlo.');
  });

  it('tells a missing image from a missing product', () => {
    const imageUrl = `/seller/products/${ID}/images/${ID}`;
    expect(toAppError(httpError(404, imageUrl, 'Image not found')).message).toBe('La imagen ya no existe.');
    expect(toAppError(httpError(404, imageUrl, 'Product not found')).message).toBe(MESSAGES.productNotFound);
  });

  it('keeps per-field validation errors', () => {
    const error = toAppError(httpError(400, '/seller/products', ['price must not be less than 0']));
    expect(error.fieldErrors).toEqual({ price: 'Debe ser mayor o igual a 0.' });
  });
});
