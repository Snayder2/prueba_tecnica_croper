import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../types/auth';
import { apiClient } from './client';

export const authApi = {
  async register(body: RegisterRequest): Promise<User> {
    const { data } = await apiClient.post<User>('/auth/register', body);
    return data;
  },

  async login(body: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', body);
    return data;
  },

  /** `token` is passed right after login, before it is stored in Redux. */
  async me(token?: string): Promise<User> {
    const { data } = await apiClient.get<User>('/auth/me', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return data;
  },
};
