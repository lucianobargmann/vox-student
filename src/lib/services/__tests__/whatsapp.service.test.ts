/**
 * @jest-environment jsdom
 */

import { whatsappService } from '../whatsapp.service';
import { apiClient } from '../../api-client';

// Mock the apiClient
jest.mock('../../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('WhatsAppService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should fetch WhatsApp settings', async () => {
      const mockSettings = {
        enabled: true,
        isAuthenticated: false,
        phoneNumber: '+5511999999999',
        rateLimitSeconds: 30,
      };

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockSettings,
      });

      const result = await whatsappService.getSettings();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSettings);
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/whatsapp/settings');
    });

    it('should handle API errors', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        success: false,
        error: 'Failed to fetch settings',
      });

      const result = await whatsappService.getSettings();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch settings');
    });
  });

  describe('updateSettings', () => {
    it('should update WhatsApp settings', async () => {
      const updateData = {
        enabled: true,
        rateLimitSeconds: 60,
      };

      const mockResponse = {
        success: true,
        message: 'Settings updated successfully',
        settings: {
          enabled: true,
          rateLimitSeconds: 60,
          isAuthenticated: false,
        },
      };

      mockApiClient.put.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await whatsappService.updateSettings(updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.put).toHaveBeenCalledWith('/api/whatsapp/settings', updateData);
    });

    it('should handle validation errors', async () => {
      const updateData = {
        enabled: true,
        rateLimitSeconds: 5, // Invalid value
      };

      mockApiClient.put.mockResolvedValueOnce({
        success: false,
        error: 'Rate limit must be between 10 and 300 seconds',
      });

      const result = await whatsappService.updateSettings(updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit must be between 10 and 300 seconds');
    });
  });

  describe('getStatus', () => {
    it('should fetch WhatsApp status', async () => {
      const mockStatus = {
        connection: {
          isReady: true,
          isInitializing: false,
          phoneNumber: '+5511999999999',
        },
        statistics: {
          totalMessages: 100,
          sentMessages: 95,
          failedMessages: 5,
          successRate: 95,
        },
      };

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: mockStatus,
      });

      const result = await whatsappService.getStatus();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStatus);
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/whatsapp/status');
    });
  });

  describe('performAction', () => {
    it('should verify WhatsApp connection', async () => {
      const mockResponse = {
        message: 'Connection verified successfully',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await whatsappService.performAction('verify');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/whatsapp/status', { action: 'verify' });
    });

    it('should restart WhatsApp service', async () => {
      const mockResponse = {
        message: 'Service restarted successfully',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await whatsappService.performAction('restart');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/whatsapp/status', { action: 'restart' });
    });
  });

  describe('sendMessage', () => {
    it('should send WhatsApp message', async () => {
      const phoneNumber = '+5511999999999';
      const message = 'Hello, this is a test message';
      
      const mockResponse = {
        success: true,
        message: 'Message sent successfully',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await whatsappService.sendMessage(phoneNumber, message);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/whatsapp/send', {
        phoneNumber,
        message,
      });
    });

    it('should handle rate limiting', async () => {
      const phoneNumber = '+5511999999999';
      const message = 'Test message';

      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Rate limit exceeded. Please wait before sending another message.',
      });

      const result = await whatsappService.sendMessage(phoneNumber, message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded. Please wait before sending another message.');
    });
  });

  describe('sendMagicLink', () => {
    it('should send magic link via WhatsApp', async () => {
      const phoneNumber = '+5511999999999';
      
      const mockResponse = {
        success: true,
        message: 'Magic link sent successfully',
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const result = await whatsappService.sendMagicLink(phoneNumber);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/api/whatsapp/magic-link', {
        phoneNumber,
      });
    });

    it('should handle invalid phone number', async () => {
      const phoneNumber = 'invalid-phone';

      mockApiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Invalid phone number format',
      });

      const result = await whatsappService.sendMagicLink(phoneNumber);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid phone number format');
    });
  });
});