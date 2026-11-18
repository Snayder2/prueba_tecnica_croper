import type { CreateProductRequest, Product, UpdateProductRequest } from '../../types/product';
import { parsePriceInput, priceToInput } from '../../utils/formatters';

/**
 * Form state. Numbers are kept as text so partial input and decimals validate exactly.
 * `price` uses the Colombian format shown in the input ("1.500,50").
 */
export interface ProductFormValues {
  name: string;
  sku: string;
  price: string;
  stock: string;
  category: string;
  description: string;
  isActive: boolean;
}

export function toFormValues(product: Product | null): ProductFormValues {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    price: product ? priceToInput(product.price) : '',
    stock: product ? String(product.stock) : '',
    category: product?.category ?? '',
    description: product?.description ?? '',
    isActive: product?.isActive ?? true,
  };
}

// Same rules as the backend (contract §4.1).
const lengthBetween = (min: number, max: number, label: string) => (value: string) => {
  const length = value.trim().length;
  if (length === 0) return `${label} es obligatorio.`;
  if (length < min) return `Debe tener al menos ${min} caracteres.`;
  if (length > max) return `Debe tener máximo ${max} caracteres.`;
  return true;
};

export const productRules = {
  name: { validate: lengthBetween(3, 100, 'El nombre') },
  sku: {
    validate: (value: string) => {
      const sku = value.trim().toUpperCase();
      const length = lengthBetween(3, 30, 'El SKU')(sku);
      if (length !== true) return length;
      return /^[A-Z0-9-]+$/.test(sku) || 'Solo letras mayúsculas, números y guiones.';
    },
  },
  price: {
    validate: (value: string) => {
      if (value.trim() === '') return 'El precio es obligatorio.';
      return (
        parsePriceInput(value) !== null ||
        'Ingresa un valor en pesos: punto para miles y coma para decimales (máximo 2). Ej.: 1.500,50'
      );
    },
  },
  stock: {
    validate: (value: string) => {
      if (value.trim() === '') return 'El stock es obligatorio.';
      return /^\d+$/.test(value.trim()) || 'Ingresa un número entero mayor o igual a 0.';
    },
  },
  category: { maxLength: { value: 50, message: 'Debe tener máximo 50 caracteres.' } },
  description: { maxLength: { value: 500, message: 'Debe tener máximo 500 caracteres.' } },
};

function normalize(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    sku: values.sku.trim().toUpperCase(),
    price: parsePriceInput(values.price) ?? Number.NaN,
    stock: Number(values.stock),
    category: values.category.trim(),
    description: values.description.trim(),
    isActive: values.isActive,
  };
}

/** Body for POST /products; empty optional fields are left out. */
export function toCreateRequest(values: ProductFormValues): CreateProductRequest {
  const { category, description, ...rest } = normalize(values);
  return {
    ...rest,
    ...(category && { category }),
    ...(description && { description }),
  };
}

/**
 * Body for PATCH /products/:id with only the fields that changed (spec §11).
 * An optional field that was emptied is sent as null so the backend clears it.
 */
export function toUpdateRequest(product: Product, values: ProductFormValues): UpdateProductRequest {
  const next = normalize(values);
  const changes: UpdateProductRequest = {};

  if (next.name !== product.name) changes.name = next.name;
  if (next.sku !== product.sku) changes.sku = next.sku;
  if (next.price !== product.price) changes.price = next.price;
  if (next.stock !== product.stock) changes.stock = next.stock;
  if (next.isActive !== product.isActive) changes.isActive = next.isActive;
  if (next.category !== (product.category ?? '')) changes.category = next.category || null;
  if (next.description !== (product.description ?? '')) changes.description = next.description || null;

  return changes;
}
