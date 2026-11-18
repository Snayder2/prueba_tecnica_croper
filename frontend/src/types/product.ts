// Product types from docs/specs/api-contract.md §3.

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive?: boolean;
}

/** `null` clears an optional field (description, category). */
export type UpdateProductRequest = {
  [K in keyof CreateProductRequest]?: CreateProductRequest[K] | null;
};

export type ProductSortField = 'name' | 'price' | 'stock' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface ProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: ProductSortField;
  order?: SortOrder;
}
