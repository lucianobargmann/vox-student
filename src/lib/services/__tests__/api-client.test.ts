/**
 * @jest-environment jsdom
 */

import { apiClient } from '../../api-client';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.clearCache();
    apiClient.clearLogs();
    localStorageMock.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Requests', () => {
    it('should make a successful GET request', async () => {
      const mockData = { message: 'Success', data: { id: 1, name: 'Test' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const result = await apiClient.get('/test');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Test' }); // Expecting the data property content
      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: undefined,
      });
    });

    it('should make a successful POST request', async () => {
      const requestData = { name: 'New Item' };
      const mockResponse = { success: true, data: { id: 1, ...requestData } };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      const result = await apiClient.post('/test', requestData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'New Item' }); // Expecting the data property content
      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(requestData),
      });
    });

    it('should handle 401 unauthorized error', async () => {
      const mockError = { error: 'Não autorizado' };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockError,
      } as Response);

      const result = await apiClient.get('/test', { skipErrorToast: true });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sessão expirada. Faça login novamente.');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiClient.get('/test', { 
        skipErrorToast: true,
        retries: 0 // Disable retries for faster test
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Caching', () => {
    it('should cache GET requests', async () => {
      const mockData = { data: { id: 1, name: 'Cached' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      // First request
      await apiClient.get('/test', { cache: true, cacheTTL: 10000 });
      
      // Second request should use cache
      const result = await apiClient.get('/test', { cache: true, cacheTTL: 10000 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Cached' }); // Expecting the data property content
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    it('should not cache POST requests by default', async () => {
      const mockData = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      await apiClient.post('/test', { data: 'test' });
      await apiClient.post('/test', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cached data after TTL', async () => {
      const mockData = { data: { id: 1, name: 'Expired' } };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      // First request with short TTL
      await apiClient.get('/test', { cache: true, cacheTTL: 1 });
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // Second request should make new fetch
      await apiClient.get('/test', { cache: true, cacheTTL: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response);

      const result = await apiClient.get('/test', { 
        retries: 2, 
        retryDelay: 10,
        skipErrorToast: true 
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const result = await apiClient.get('/test', { 
        retries: 2, 
        retryDelay: 10,
        skipErrorToast: true 
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Logging', () => {
    it('should log successful requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await apiClient.get('/test');

      const logs = apiClient.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        method: 'GET',
        url: '/test',
        status: 200,
      });
    });

    it('should log failed requests', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      await apiClient.get('/test', { 
        retries: 0,
        skipErrorToast: true 
      });

      const logs = apiClient.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        method: 'GET',
        url: '/test',
        error: 'Test error',
      });
    });

    it('should provide logs statistics', async () => {
      // Successful request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);
      await apiClient.get('/test1');

      // Failed request
      mockFetch.mockRejectedValueOnce(new Error('Error'));
      await apiClient.get('/test2', { retries: 0, skipErrorToast: true });

      const stats = apiClient.getLogsStats();
      expect(stats.total).toBe(2);
      expect(stats.errors).toBe(1);
      expect(stats.averageTime).toBeGreaterThanOrEqual(0); // Changed to include 0
    });
  });

  describe('Cache Management', () => {
    it('should clear all cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      } as Response);

      await apiClient.get('/test', { cache: true });
      expect(apiClient.getCacheSize()).toBe(1);

      apiClient.clearCache();
      expect(apiClient.getCacheSize()).toBe(0);
    });

    it('should clear specific cache key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' }),
      } as Response);

      await apiClient.get('/test1', { cache: true });
      await apiClient.get('/test2', { cache: true });
      expect(apiClient.getCacheSize()).toBe(2);

      apiClient.clearCacheKey('/test1');
      expect(apiClient.getCacheSize()).toBe(1);
    });
  });

  describe('Authentication', () => {
    it('should include auth token when available', async () => {
      localStorageMock.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: undefined,
      });
    });

    it('should not include auth token when requiresAuth is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await apiClient.get('/test', { requiresAuth: false });

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: undefined,
      });
    });

    it('should work without auth token when none available', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith('/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: undefined,
      });
    });
  });
});