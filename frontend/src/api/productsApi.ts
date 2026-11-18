import type { PaginatedResponse } from '../types/api';
import type {
  CreateProductRequest,
  Product,
  ProductsQuery,
  UpdateProductRequest,
} from '../types/product';
import { apiClient } from './client';

export const productsApi = {
  async list(query: ProductsQuery, signal?: AbortSignal): Promise<PaginatedResponse<Product>> {
    // Empty search is omitted so the backend does not receive `search=`.
    const params = { ...query, search: query.search || undefined };
    const { data } = await apiClient.get<PaginatedResponse<Product>>('/products', { params, signal });
    return data;
  },

  async create(body: CreateProductRequest): Promise<Product> {
    const { data } = await apiClient.post<Product>('/products', body);
    return data;
  },

  async update(id: string, body: UpdateProductRequest): Promise<Product> {
    const { data } = await apiClient.patch<Product>(`/products/${id}`, body);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/products/${id}`);
  },
};
