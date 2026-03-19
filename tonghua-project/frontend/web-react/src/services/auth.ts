import api from './api';
import type { User } from '@/types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * HTTP-Only Cookie Authentication Strategy:
 * - Access tokens are stored in memory (reactive store state)
 * - Refresh tokens are stored in httpOnly cookies set by the server
 * - The API interceptor (api.ts) automatically handles token refresh on 401 errors
 * - Do NOT manually inject tokens into request bodies or headers
 *
 * Token refresh flow:
 * 1. Client makes a request with expired access token in memory
 * 2. Server returns 401 Unauthorized
 * 3. Interceptor catches 401 and sends a POST to /auth/refresh WITH credentials (cookies)
 * 4. Server validates the httpOnly refresh token cookie and issues new tokens
 * 5. New tokens are stored (access token in memory, refresh token in new cookie)
 * 6. Original request is retried with the new access token
 */
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    // Note: Tokens are cleared from memory by useAuthStore after this call
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/profile');
    return response.data;
  },

  // REMOVED: Legacy method that injected token in request body
  // The correct approach uses httpOnly cookies managed by api.ts interceptor
};
