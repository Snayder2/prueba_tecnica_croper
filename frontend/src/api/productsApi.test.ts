import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { apiClient } from './client';
import { productsApi } from './productsApi';

/** Captures the request as axios would send it, after its request transforms. */
function captureRequests() {
  const sent: InternalAxiosRequestConfig[] = [];
  apiClient.defaults.adapter = async (config) => {
    sent.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  return sent;
}

const originalAdapter = apiClient.defaults.adapter;
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe('productsApi', () => {
  it('uploadImage sends the file as multipart FormData, not converted to JSON', async () => {
    const sent = captureRequests();
    const file = new File([new Uint8Array(10)], 'foto.jpg', { type: 'image/jpeg' });

    await productsApi.uploadImage('6739f3b2c4e5b8a9d0f12346', file);

    const [request] = sent;
    expect(request.data).toBeInstanceOf(FormData);
    expect((request.data as FormData).get('image')).toBe(file);
    // The browser sets multipart/form-data with its boundary.
    expect(String(request.headers.getContentType() ?? '')).not.toContain('application/json');
  });

  it('JSON bodies are still sent as application/json', async () => {
    const sent = captureRequests();

    await productsApi.setDiscount('6739f3b2c4e5b8a9d0f12346', 15);

    const [request] = sent;
    expect(request.data).toBe('{"percent":15}');
    expect(request.headers.getContentType()).toContain('application/json');
  });
});
