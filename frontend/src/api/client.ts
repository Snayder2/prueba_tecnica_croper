import axios from 'axios';
import { toAppError } from '../utils/errorMessages';

// No fixed Content-Type: axios sets application/json for object bodies and
// leaves FormData to the browser (multipart/form-data with its boundary).
// A fixed application/json would make axios turn the image upload's FormData
// into JSON ({"image":{}}), and the backend would answer "Image is required".
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15_000,
});

interface ApiClientOptions {
  /** Current token, read on every request. */
  getToken: () => string | null;
  /** Called once when a request fails with 401 while there is a session. */
  onSessionExpired: () => void;
}

let ejectInterceptors: (() => void) | null = null;

/**
 * Wires the token and error handling (spec §6.1). The store passes callbacks,
 * so this module never imports the store (no circular dependency).
 */
export function setupApiClient({ getToken, onSessionExpired }: ApiClientOptions): void {
  ejectInterceptors?.();

  const requestId = apiClient.interceptors.request.use((config) => {
    const token = getToken();
    if (token && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  const responseId = apiClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isCancel(error)) return Promise.reject(error);

      const appError = toAppError(error);
      const url = axios.isAxiosError(error) ? (error.config?.url ?? '') : '';
      if (appError.status === 401 && !url.includes('/auth/login')) {
        // Only the first failing request closes the session; parallel ones
        // are marked as handled so the UI does not repeat the notice.
        appError.handled = true;
        if (getToken()) onSessionExpired();
      }
      return Promise.reject(appError);
    },
  );

  ejectInterceptors = () => {
    apiClient.interceptors.request.eject(requestId);
    apiClient.interceptors.response.eject(responseId);
  };
}
