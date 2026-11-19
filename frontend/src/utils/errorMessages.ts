import type { ApiError, AppError } from '../types/api';

export const MESSAGES = {
  network: 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  invalidCredentials: 'Correo o contraseña incorrectos.',
  sessionExpired: 'Tu sesión expiró, inicia sesión de nuevo.',
  productNotFound: 'El producto ya no existe. Es posible que otra persona lo haya eliminado.',
  invalidProduct: 'El producto no es válido.',
  duplicateSku: 'Ya existe un producto con ese SKU.',
  duplicateEmail: 'Ya existe una cuenta con ese correo.',
  tooManyRequests: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.',
  invalidData: 'Revisa los datos del formulario.',
  unexpected: 'Ocurrió un error inesperado. Inténtalo más tarde.',
  // Contract 1.1.0 §6.2
  forbidden: 'No tienes acceso a esa sección.',
  insufficientStock: 'No hay suficiente stock para esa salida.',
  imageLimit: 'Este producto ya tiene 4 imágenes.',
  imageTooLarge: 'La imagen pesa más de 1 MB.',
  unsupportedImage: 'Formato no permitido. Usa JPG, PNG o WebP.',
  imageUploadFailed: 'No se pudo subir la imagen.',
  imageDimensions: 'La imagen tiene demasiados píxeles. El máximo es 40 megapíxeles.',
  imagesChanged: 'Las imágenes cambiaron. Vuelve a intentarlo.',
  imageNotFound: 'La imagen ya no existe.',
  productUnavailable: 'Este producto ya no está disponible',
} as const;

// Requests are told apart by their route, never by the message text (contract §6.2).
const IMAGE_UPLOAD_URL = /\/images$/;
const IMAGE_ORDER_URL = /\/images\/order$/;
const STOCK_URL = /\/stock-adjustments$/;

/** Minimal shape of an Axios error, so this module does not depend on axios. */
export interface HttpErrorLike {
  response?: { status: number; data?: unknown };
  config?: { url?: string };
}

// class-validator messages start with the field name (contract §6.1).
// Each rule turns the English rule into a Spanish message for the field.
const VALIDATION_RULES: { pattern: RegExp; message: (match: RegExpMatchArray) => string }[] = [
  { pattern: /must be longer than or equal to (\d+) characters/, message: (m) => `Debe tener al menos ${m[1]} caracteres.` },
  { pattern: /must be shorter than or equal to (\d+) characters/, message: (m) => `Debe tener máximo ${m[1]} caracteres.` },
  { pattern: /must not be less than (-?\d+)/, message: (m) => `Debe ser mayor o igual a ${m[1]}.` },
  { pattern: /must not be greater than (-?\d+)/, message: (m) => `Debe ser menor o igual a ${m[1]}.` },
  { pattern: /must be an integer number/, message: () => 'Debe ser un número entero.' },
  { pattern: /must be a number conforming/, message: () => 'Debe ser un número con máximo 2 decimales.' },
  { pattern: /must be an email/, message: () => 'Ingresa un correo válido.' },
  { pattern: /must contain at least one letter and one number/, message: () => 'Debe contener al menos una letra y un número.' },
  { pattern: /must match .* regular expression/, message: () => 'El formato no es válido.' },
  { pattern: /should not be null|should not be empty/, message: () => 'Este campo es obligatorio.' },
  { pattern: /must be a boolean/, message: () => 'Debe ser verdadero o falso.' },
  { pattern: /must be a string/, message: () => 'Debe ser un texto.' },
];

function translateValidationMessage(text: string): string {
  for (const rule of VALIDATION_RULES) {
    const match = text.match(rule.pattern);
    if (match) return rule.message(match);
  }
  return 'El valor no es válido.';
}

/** Maps "price must not be less than 0" to { price: "Debe ser mayor o igual a 0." }. */
export function validationMessagesToFieldErrors(messages: string[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const text of messages) {
    const field = /^property (\w+) should not exist/.test(text) ? null : text.split(' ')[0];
    if (field && !(field in fieldErrors)) {
      fieldErrors[field] = translateValidationMessage(text);
    }
  }
  return fieldErrors;
}

function isApiError(data: unknown): data is ApiError {
  return typeof data === 'object' && data !== null && 'statusCode' in data && 'message' in data;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'message' in value &&
    'fieldErrors' in value
  );
}

function appError(status: number | null, message: string, fieldErrors: Record<string, string> = {}): AppError {
  return { status, message, fieldErrors, handled: false };
}

/**
 * Converts any request failure into an AppError with a friendly Spanish message
 * (spec §6.2). The endpoint decides how 401 and 409 are read (contract §6.2).
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  const httpError = error as HttpErrorLike;
  const response = httpError?.response;
  if (!response) return appError(null, MESSAGES.network);

  const url = httpError.config?.url ?? '';
  const isLogin = url.includes('/auth/login');
  const isRegister = url.includes('/auth/register');
  const { status } = response;
  const body = isApiError(response.data) ? response.data : null;
  const messages = body ? (Array.isArray(body.message) ? body.message : [body.message]) : [];

  switch (status) {
    case 400: {
      if (messages.includes('Invalid id')) return appError(400, MESSAGES.invalidProduct);
      if (IMAGE_UPLOAD_URL.test(url)) {
        return appError(
          400,
          messages.includes('Image dimensions too large')
            ? MESSAGES.imageDimensions
            : MESSAGES.imageUploadFailed,
        );
      }
      if (IMAGE_ORDER_URL.test(url)) return appError(400, MESSAGES.imagesChanged);
      const fieldErrors = validationMessagesToFieldErrors(messages);
      return appError(400, MESSAGES.invalidData, fieldErrors);
    }
    case 401:
      return appError(401, isLogin ? MESSAGES.invalidCredentials : MESSAGES.sessionExpired);
    case 403:
      return appError(403, MESSAGES.forbidden);
    case 404:
      return appError(
        404,
        messages.includes('Image not found') ? MESSAGES.imageNotFound : MESSAGES.productNotFound,
      );
    case 409:
      if (isRegister) {
        return appError(409, MESSAGES.duplicateEmail, { email: MESSAGES.duplicateEmail });
      }
      if (STOCK_URL.test(url)) {
        return appError(409, MESSAGES.insufficientStock, { quantity: MESSAGES.insufficientStock });
      }
      if (IMAGE_UPLOAD_URL.test(url)) return appError(409, MESSAGES.imageLimit);
      return appError(409, MESSAGES.duplicateSku, { sku: MESSAGES.duplicateSku });
    case 413:
      return appError(413, MESSAGES.imageTooLarge);
    case 415:
      return appError(415, MESSAGES.unsupportedImage);
    case 429:
      return appError(429, MESSAGES.tooManyRequests);
    default:
      return appError(status, MESSAGES.unexpected);
  }
}
