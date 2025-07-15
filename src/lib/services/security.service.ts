import { apiClient, ApiResponse } from '../api-client';

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  description: string;
  timestamp: string;
  user?: {
    email: string;
    profile?: {
      fullName: string;
    };
  };
}

export interface AuditLog {
  id: string;
  action: string;
  tableName: string;
  timestamp: string;
  user?: {
    email: string;
    profile?: {
      fullName: string;
    };
  };
}

export interface SecurityDashboardData {
  summary: {
    totalSecurityEvents: number;
    totalAuditLogs: number;
    failedLoginAttempts: number;
    activeUsers: number;
  };
  statistics: {
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    actionsByType: Record<string, number>;
  };
  recentEvents: SecurityEvent[];
  recentAuditLogs: AuditLog[];
  failedLogins: SecurityEvent[];
}

class SecurityService {
  async getDashboardData(): Promise<ApiResponse<SecurityDashboardData>> {
    return apiClient.get<SecurityDashboardData>('/api/security/dashboard');
  }

  async getSecurityEvents(page?: number, limit?: number): Promise<ApiResponse<{ events: SecurityEvent[]; total: number }>> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    
    const url = `/api/security/events${params.toString() ? `?${params.toString()}` : ''}`;
    return apiClient.get<{ events: SecurityEvent[]; total: number }>(url);
  }

  async createSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<ApiResponse<SecurityEvent>> {
    return apiClient.post<SecurityEvent>('/api/security/events', eventData);
  }
}

export const securityService = new SecurityService();