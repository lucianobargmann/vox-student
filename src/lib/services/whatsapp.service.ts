import { apiClient, ApiResponse } from '../api-client';

export interface WhatsAppSettings {
  enabled: boolean;
  isAuthenticated: boolean;
  phoneNumber?: string;
  rateLimitSeconds: number;
  lastConnectionCheck?: string;
  qrCode?: string;
}

export interface WhatsAppStatus {
  connection?: {
    isReady: boolean;
    isInitializing: boolean;
    phoneNumber?: string;
    qrCode?: string;
    isAuthenticated?: boolean;
    lastConnectionCheck?: string;
  };
  settings?: {
    enabled: boolean;
    rateLimitSeconds: number;
  };
  statistics?: {
    totalMessages: number;
    sentMessages: number;
    failedMessages: number;
    recentMessages?: number;
    successRate: string;
  };
}

export interface UpdateWhatsAppSettingsRequest {
  enabled: boolean;
  rateLimitSeconds: number;
}

export interface WhatsAppActionRequest {
  action: 'verify' | 'restart';
}

export interface QueueStatistics {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  sentMessages: number;
  failedMessages: number;
  successRate: string;
}

export interface QueueResponse {
  statistics: QueueStatistics;
  queue: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class WhatsAppService {
  async getSettings(): Promise<ApiResponse<WhatsAppSettings>> {
    return apiClient.get<WhatsAppSettings>('/api/whatsapp/settings');
  }

  async updateSettings(settings: UpdateWhatsAppSettingsRequest): Promise<ApiResponse<{ success: boolean; message: string; settings: WhatsAppSettings }>> {
    return apiClient.put('/api/whatsapp/settings', settings);
  }

  async getStatus(): Promise<ApiResponse<WhatsAppStatus>> {
    return apiClient.get<WhatsAppStatus>('/api/whatsapp/status');
  }

  async performAction(action: 'verify' | 'restart'): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post('/api/whatsapp/status', { action });
  }

  async sendMessage(phoneNumber: string, message: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.post('/api/whatsapp/send', { phoneNumber, message });
  }

  async sendMagicLink(phoneNumber: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.post('/api/whatsapp/magic-link', { phoneNumber });
  }

  async getQueue(): Promise<ApiResponse<QueueResponse>> {
    return apiClient.get<QueueResponse>('/api/queue');
  }
}

export const whatsappService = new WhatsAppService();