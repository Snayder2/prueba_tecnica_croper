// Product types from docs/specs/api-contract.md §3 (contract 1.1.0).

export interface ProductImage {
  _id: string;
  /** Absolute, WebP, at most 1200 px per side. */
  url: string;
  /** Absolute, WebP, 400 × 400 px. */
  thumbUrl: string;
  /** Size of the large image. */
  width: number;
  height: number;
}

/** The seller's email is never exposed. */
export interface SellerSummary {
  _id: string;
  name: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  /** List price. */
  price: number;
  /** 0 = no discount. */
  discountPercent: number;
  /** Computed by the backend. */
  finalPrice: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  /** images[0] is the main image; may be empty. */
  images: ProductImage[];
  seller: SellerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  /** Initial stock. */
  stock: number;
  category?: string;
  sku: string;
  isActive?: boolean;
}

/** Stock is not edited here (StockAdjustmentRequest). `null` clears description or category. */
export type UpdateProductRequest = Partial<
  Omit<CreateProductRequest, 'stock' | 'description' | 'category'>
> & {
  description?: string | null;
  category?: string | null;
};

export interface StockAdjustmentRequest {
  type: 'increase' | 'decrease';
  quantity: number;
}

export interface DiscountRequest {
  percent: number;
}

export interface ReorderImagesRequest {
  imageIds: string[];
}

export type SortOrder = 'asc' | 'desc';
export type SellerProductSortField = 'name' | 'price' | 'finalPrice' | 'stock' | 'createdAt';
export type CatalogSortField = 'createdAt' | 'finalPrice' | 'name' | 'discountPercent';

export interface SellerProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: SellerProductSortField;
  order?: SortOrder;
}

export interface CatalogQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  inStock?: boolean;
  sortBy?: CatalogSortField;
  order?: SortOrder;
}
