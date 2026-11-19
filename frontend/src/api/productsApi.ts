import type { PaginatedResponse } from '../types/api';
import type {
  CreateProductRequest,
  Product,
  SellerProductsQuery,
  StockAdjustmentRequest,
  UpdateProductRequest,
} from '../types/product';
import { apiClient } from './client';

/** Product management of the logged-in seller (contract §2.3). */
const BASE = '/seller/products';

export const productsApi = {
  async list(query: SellerProductsQuery, signal?: AbortSignal): Promise<PaginatedResponse<Product>> {
    // Empty search is omitted so the backend does not receive `search=`.
    const params = { ...query, search: query.search || undefined };
    const { data } = await apiClient.get<PaginatedResponse<Product>>(BASE, { params, signal });
    return data;
  },

  async get(id: string): Promise<Product> {
    const { data } = await apiClient.get<Product>(`${BASE}/${id}`);
    return data;
  },

  async create(body: CreateProductRequest): Promise<Product> {
    const { data } = await apiClient.post<Product>(BASE, body);
    return data;
  },

  async update(id: string, body: UpdateProductRequest): Promise<Product> {
    const { data } = await apiClient.patch<Product>(`${BASE}/${id}`, body);
    return data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/${id}`);
  },

  async adjustStock(id: string, body: StockAdjustmentRequest): Promise<Product> {
    const { data } = await apiClient.post<Product>(`${BASE}/${id}/stock-adjustments`, body);
    return data;
  },

  async setDiscount(id: string, percent: number): Promise<Product> {
    const { data } = await apiClient.put<Product>(`${BASE}/${id}/discount`, { percent });
    return data;
  },

  async removeDiscount(id: string): Promise<Product> {
    const { data } = await apiClient.delete<Product>(`${BASE}/${id}/discount`);
    return data;
  },

  /**
   * One image per request (field `image`). The Content-Type is not set by hand:
   * axios adds multipart/form-data with the right boundary for a FormData.
   */
  async uploadImage(id: string, file: File, onProgress?: (percent: number) => void): Promise<Product> {
    const form = new FormData();
    form.append('image', file);
    const { data } = await apiClient.post<Product>(`${BASE}/${id}/images`, form, {
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return data;
  },

  async deleteImage(id: string, imageId: string): Promise<Product> {
    const { data } = await apiClient.delete<Product>(`${BASE}/${id}/images/${imageId}`);
    return data;
  },

  async reorderImages(id: string, imageIds: string[]): Promise<Product> {
    const { data } = await apiClient.put<Product>(`${BASE}/${id}/images/order`, { imageIds });
    return data;
  },
};
