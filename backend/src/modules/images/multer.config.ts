import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const MAX_IMAGE_BYTES = 1_048_576; // 1 MB
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Multer options for product image uploads (spec 03 §7.2). Multer comes with
 * @nestjs/platform-express; its errors become HTTP exceptions:
 * LIMIT_FILE_SIZE → 413, LIMIT_FILE_COUNT / LIMIT_FIELD_COUNT /
 * LIMIT_UNEXPECTED_FILE → 400, and the fileFilter error below → 415.
 */
export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(), // el archivo queda en file.buffer; nunca toca el disco sin procesar
  limits: {
    fileSize: MAX_IMAGE_BYTES, // Multer deja de leer al pasarse → 413
    files: 1, // un archivo por petición → 400
    fields: 0, // no se aceptan campos de texto en el formulario → 400
    parts: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Filtro rápido por el Content-Type declarado. No es la validación real (ver ImageFilePipe).
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      return cb(new UnsupportedMediaTypeException('Unsupported file type'), false);
    }
    cb(null, true);
  },
};
