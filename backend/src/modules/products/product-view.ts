import { Types } from 'mongoose';
import type { ProductImageRecord } from './schemas/product-image.schema.js';
import type { ProductRecord } from './schemas/product.schema.js';

/** Public seller data inside a product. The seller's email is never exposed. */
export interface SellerSummary {
  _id: Types.ObjectId;
  name: string;
}

export interface ProductImageView {
  _id: Types.ObjectId;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

/** `Product` of the contract (§3): what every product endpoint returns. */
export interface ProductView {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  price: number;
  discountPercent: number;
  finalPrice: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  images: ProductImageView[];
  seller: SellerSummary;
  createdAt: Date;
  updatedAt: Date;
}

/** Product as read with `populate('sellerId', 'name')`. */
export type ProductWithSeller = Omit<ProductRecord, 'sellerId'> & { sellerId: SellerSummary };

function toImageView(image: ProductImageRecord): ProductImageView {
  return {
    _id: image._id,
    url: image.url,
    thumbUrl: image.thumbUrl,
    width: image.width,
    height: image.height,
  };
}

/**
 * Whitelists the public fields: `sellerId` becomes `seller: { _id, name }` and
 * the internal storage `key` of each image is dropped.
 */
export function toProductView(product: ProductRecord, seller: SellerSummary): ProductView {
  return {
    _id: product._id,
    name: product.name,
    ...(product.description !== undefined && { description: product.description }),
    price: product.price,
    discountPercent: product.discountPercent,
    finalPrice: product.finalPrice,
    stock: product.stock,
    ...(product.category !== undefined && { category: product.category }),
    sku: product.sku,
    isActive: product.isActive,
    images: (product.images ?? []).map(toImageView),
    seller: { _id: seller._id, name: seller.name },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/** Same as toProductView for a product whose seller was populated. */
export function toProductViewWithSeller(product: ProductWithSeller): ProductView {
  return toProductView({ ...product, sellerId: product.sellerId._id }, product.sellerId);
}
