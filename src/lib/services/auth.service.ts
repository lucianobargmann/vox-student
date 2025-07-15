import { apiClient, ApiResponse } from '../api-client';

export interface User {
  id: string;
  email: string;
  profile: {
    id: string;
    fullName: string | null;
    role: string;
  };
}

export interface LoginRequest {
  email: string;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

class AuthService {
  async requestMagicLink(email: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post('/api/auth/magic-link', { email }, { requiresAuth: false });
  }

  async verifyMagicLink(token: string): Promise<ApiResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>('/api/auth/verify', { token }, { requiresAuth: false });
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return apiClient.get<{ user: User }>('/api/auth/me');
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const result = await apiClient.post<{ message: string }>('/api/auth/logout');
    
    // Clear token from localStorage after successful logout
    if (result.success && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
    
    return result;
  }

  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }
}

export const authService = new AuthService();