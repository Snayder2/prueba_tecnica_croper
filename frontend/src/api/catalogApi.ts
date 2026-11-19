import type { PaginatedResponse } from '../types/api';
import type { CatalogQuery, Product } from '../types/product';
import { apiClient } from './client';

/** Read-only catalog for any logged-in user (contract §2.2). */
export const catalogApi = {
  async list(query: CatalogQuery, signal?: AbortSignal): Promise<PaginatedResponse<Product>> {
    // Defaults and empty values are omitted to keep the request (and caches) clean.
    const params = {
      ...query,
      search: query.search || undefined,
      category: query.category || undefined,
      onSale: query.onSale || undefined,
      inStock: query.inStock || undefined,
    };
    const { data } = await apiClient.get<PaginatedResponse<Product>>('/products', { params, signal });
    return data;
  },

  async categories(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>('/products/categories');
    return data;
  },

  async get(id: string, signal?: AbortSignal): Promise<Product> {
    const { data } = await apiClient.get<Product>(`/products/${id}`, { signal });
    return data;
  },
};
