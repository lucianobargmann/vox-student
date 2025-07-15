/**
 * @jest-environment jsdom
 */

import { authService } from '../auth.service';
import { apiClient } from '../../api-client';

// Mock the apiClient
jest.mock('../../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  }
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestMagicLink', () => {
    it('should request magic link successfully', async () => {
      const email = 'test@example.com';
      const mockResponse = {
        message: 'Magic link sent to your email',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await authService.requestMagicLink(email);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/auth/magic-link',
        { email },
        { requiresAuth: false }
      );
    });

    it('should handle invalid email', async () => {
      const email = 'invalid-email';

      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Invalid email format',
      });

      const result = await authService.requestMagicLink(email);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });
  });

  describe('verifyMagicLink', () => {
    it('should verify magic link token successfully', async () => {
      const token = 'valid-token';
      const mockResponse = {
        token: 'jwt-token',
        user: {
          id: 'user-id',
          email: 'test@example.com',
          profile: {
            id: 'profile-id',
            fullName: 'Test User',
            role: 'admin',
          },
        },
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await authService.verifyMagicLink(token);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/api/auth/verify',
        { token },
        { requiresAuth: false }
      );
    });

    it('should handle invalid token', async () => {
      const token = 'invalid-token';

      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Invalid or expired token',
      });

      const result = await authService.verifyMagicLink(token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockUser = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          profile: {
            id: 'profile-id',
            fullName: 'Test User',
            role: 'admin',
          },
        },
      };

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockUser,
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUser);
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/me');
    });

    it('should handle unauthorized request', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized',
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockResponse = {
        message: 'Logged out successfully',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await authService.logout();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should clear token even if API call fails', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Server error',
      });

      const result = await authService.logout();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
      // Token should still be removed from localStorage
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    it('should set auth token', () => {
      const token = 'test-token';
      
      authService.setAuthToken(token);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', token);
    });

    it('should clear auth token', () => {
      authService.clearAuthToken();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should get auth token', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      
      const token = authService.getAuthToken();
      
      expect(token).toBe('stored-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_token');
    });

    it('should return null when no token exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const token = authService.getAuthToken();
      
      expect(token).toBeNull();
    });
  });
});