import { API_PREFIX } from '../../app.setup.js';

export type ImageVariant = 'large' | 'thumb';

/**
 * Absolute public URLs of a product image (spec 03 §7.4), built with
 * PUBLIC_BASE_URL. They point to the public image endpoint
 * (`GET /products/:id/images/:imageId` and `.../thumb`), which reads the
 * base64 from MongoDB and answers the binary.
 */
export function productImageUrls(
  publicBaseUrl: string,
  productId: string,
  imageId: string,
): { url: string; thumbUrl: string } {
  const url = `${publicBaseUrl.replace(/\/+$/, '')}/${API_PREFIX}/products/${productId}/images/${imageId}`;
  return { url, thumbUrl: `${url}/thumb` };
}
