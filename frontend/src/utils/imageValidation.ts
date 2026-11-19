import { formatFileSize } from './formatters';

/** Same limits as the backend (contract §4.5). */
export const MAX_IMAGE_BYTES = 1_048_576; // 1 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PRODUCT_IMAGES = 5;
/** `accept` of the file input. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

export type ImageValidation = { ok: true } | { ok: false; message: string };

/**
 * Checked before uploading (spec 03 §13.4), so a rejected file never makes a
 * request. The backend checks again with the real content of the file.
 */
export function validateImageFile(file: File): ImageValidation {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: `${file.name} no es una imagen válida. Usa JPG, PNG o WebP.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: `${file.name} pesa ${formatFileSize(file.size)}. El máximo es 1 MB.` };
  }
  return { ok: true };
}
